/**
 * @module lib/actions/billing
 * Stripe Checkout / カスタマーポータルのセッション生成（Server Actions）。
 *
 * plan の更新はここでは行わない（Webhook が唯一の更新経路）。
 * stripe_customer_id の保存だけは admin（service_role）で行う:
 * profiles の該当列は authenticated の UPDATE 権限から外してあるため（自己アップグレード防止）。
 */
'use server'

import {
  ERR_AUTH_REQUIRED,
  ERR_BILLING_CHECKOUT_FAILED,
  ERR_BILLING_PORTAL_FAILED,
  ERR_BILLING_NO_SUBSCRIPTION,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import { PLAN_PRICE_ENV, type BillingPlan } from '@/lib/constants/billing'
import { ROUTES } from '@/lib/constants/routes'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'
import { requireEnv } from '@/lib/utils/env'
import { actionError, actionSuccess, type ActionResult } from '@/types/action-result'
import { checkoutSchema } from '@/lib/validations/billing'

function appUrl(): string {
  return requireEnv(process.env.NEXT_PUBLIC_APP_URL, 'NEXT_PUBLIC_APP_URL')
}

async function getOrCreateCustomerId(userId: string, email: string | undefined): Promise<string> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.stripe_customer_id) return profile.stripe_customer_id

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  })

  // stripe_customer_id は Webhook 以外で唯一ここだけが書く。列権限の都合で admin を使う。
  const admin = createAdminClient()
  await admin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', userId)

  return customer.id
}

export async function createCheckoutSession(input: {
  plan: BillingPlan
}): Promise<ActionResult<{ url: string }>> {
  // 1. 認証
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return actionError(ERR_AUTH_REQUIRED)

  // 2. Zod バリデーション
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const priceId = process.env[PLAN_PRICE_ENV[parsed.data.plan]]
  if (!priceId) return actionError(ERR_BILLING_CHECKOUT_FAILED)

  try {
    const customerId = await getOrCreateCustomerId(user.id, user.email)
    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl()}${ROUTES.SETTINGS_PLAN}?status=success`,
      cancel_url: `${appUrl()}${ROUTES.SETTINGS_PLAN}?status=cancel`,
      // Webhook 側でユーザーを特定するため subscription にも userId を付与する
      subscription_data: { metadata: { userId: user.id } },
      metadata: { userId: user.id },
    })

    if (!session.url) return actionError(ERR_BILLING_CHECKOUT_FAILED)
    return actionSuccess({ url: session.url })
  } catch {
    return actionError(ERR_BILLING_CHECKOUT_FAILED)
  }
}

export async function createPortalSession(): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return actionError(ERR_AUTH_REQUIRED)

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.stripe_customer_id) return actionError(ERR_BILLING_NO_SUBSCRIPTION)

  try {
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl()}${ROUTES.SETTINGS_PLAN}`,
    })
    return actionSuccess({ url: session.url })
  } catch {
    return actionError(ERR_BILLING_PORTAL_FAILED)
  }
}
