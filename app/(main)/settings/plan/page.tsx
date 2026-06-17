import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PlanView } from '@/components/settings/PlanView'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = {
  title: 'プラン | Notea',
  robots: { index: false },
}

export default async function PlanSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_current_period_end')
    .eq('id', user.id)
    .single()

  const plan: 'free' | 'paid' = profile?.plan === 'paid' ? 'paid' : 'free'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
      <div className="flex items-center gap-3 md:hidden">
        <Link
          href={ROUTES.SETTINGS}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← 設定
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">プラン</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan === 'paid'
            ? 'プレミアムプランをご利用中です。'
            : '無料プランをご利用中です。上限を増やすにはアップグレードしてください。'}
        </p>
      </div>

      <PlanView plan={plan} periodEnd={profile?.plan_current_period_end ?? null} />
    </div>
  )
}
