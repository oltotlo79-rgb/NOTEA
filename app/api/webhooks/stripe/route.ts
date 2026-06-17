/**
 * @module app/api/webhooks/stripe
 * Stripe Webhook。サブスクリプションの状態変化を受けて profiles.plan を更新する。
 *
 * proxy は /api を認証リダイレクト対象外にするため、この route が最終防衛線:
 * 署名検証（constructEvent）→ 冪等ガード（webhook_events）→ admin で plan 更新。
 * 鍵・ボディはログ/DB に残さない（Cache-Control: no-store）。plan の更新経路はここだけ。
 */
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'
import { requireEnv } from '@/lib/utils/env'

const NO_STORE = { 'Cache-Control': 'no-store' }

// 課金状態を「有料」とみなす Stripe サブスクリプション状態
const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing'])

async function setPlanByCustomer(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  plan: 'free' | 'paid',
  periodEnd: number | null
): Promise<void> {
  await admin
    .from('profiles')
    .update({
      plan,
      plan_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    })
    .eq('stripe_customer_id', customerId)
}

async function handleEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const customerId = typeof session.customer === 'string' ? session.customer : null
      if (customerId) await setPlanByCustomer(admin, customerId, 'paid', null)
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object
      const customerId = typeof sub.customer === 'string' ? sub.customer : null
      if (customerId) {
        const plan = ACTIVE_STATUSES.has(sub.status) ? 'paid' : 'free'
        // Stripe v22（新 API）では期間末は subscription item 単位に持つ
        const periodEnd = sub.items?.data?.[0]?.current_period_end ?? null
        await setPlanByCustomer(admin, customerId, plan, periodEnd)
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const customerId = typeof sub.customer === 'string' ? sub.customer : null
      if (customerId) await setPlanByCustomer(admin, customerId, 'free', null)
      break
    }
    default:
      // 関心のないイベントは無視（200 を返して再送を止める）
      break
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400, headers: NO_STORE })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      requireEnv(process.env.STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET')
    )
  } catch {
    // 署名不正・改竄。ボディや詳細は記録しない。
    return NextResponse.json({ error: 'invalid signature' }, { status: 400, headers: NO_STORE })
  }

  const admin = createAdminClient()

  // 冪等ガード: 既に処理済みの event は二重処理しない（Stripe のリトライ対策）。
  const { error: insertError } = await admin
    .from('webhook_events')
    .insert({ id: event.id, type: event.type })

  // 一意制約違反（重複）なら処理済みとして 200 を返す
  if (insertError) {
    return NextResponse.json({ received: true, duplicate: true }, { headers: NO_STORE })
  }

  try {
    await handleEvent(admin, event)
  } catch {
    // 処理失敗時はクレーム行を削除してから 500 を返す。
    // こうしないと Stripe の再送が重複ガードで弾かれ、二度と再処理されなくなる。
    await admin.from('webhook_events').delete().eq('id', event.id)
    return NextResponse.json({ error: 'handler failed' }, { status: 500, headers: NO_STORE })
  }

  return NextResponse.json({ received: true }, { headers: NO_STORE })
}
