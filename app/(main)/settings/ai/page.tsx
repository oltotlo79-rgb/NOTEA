import Link from 'next/link'
import type { Metadata } from 'next'
import { LockKeyhole } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAiUsageToday } from '@/lib/actions/ai'
import { AiKeyManager } from '@/components/settings/AiKeyManager'
import { AiUsagePanel } from '@/components/settings/AiUsagePanel'
import { AI_PROVIDERS } from '@/lib/constants/limits/ai'
import { ROUTES } from '@/lib/constants/routes'
import { FREE_AI_DAILY_LIMIT, PAID_AI_DAILY_LIMIT } from '@/lib/constants/limits/ai'

export const metadata: Metadata = {
  title: 'AI キー管理 | Notea',
  robots: { index: false },
}

export default async function AiSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()
    : { data: null }

  const plan: 'free' | 'paid' = profile?.plan === 'paid' ? 'paid' : 'free'

  const usageData = await getAiUsageToday()
  const limit = plan === 'paid' ? PAID_AI_DAILY_LIMIT : FREE_AI_DAILY_LIMIT
  const totalUsed = usageData.providers.reduce((sum, p) => sum + p.count, 0)
  const remaining = Math.max(0, limit - totalUsed)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* ページタイトル */}
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.SETTINGS}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← 設定
        </Link>
      </div>
      <h1 className="text-2xl font-bold">AI キー管理</h1>

      {/* 残回数パネル */}
      <AiUsagePanel
        initialRemaining={remaining}
        initialLimit={limit}
        initialPlan={plan}
      />

      {/* セキュリティ説明バナー */}
      <div
        className="bg-muted/50 border border-border rounded-lg p-4 flex flex-col gap-2"
        role="region"
        aria-label="キーの保存について"
        data-testid="ai-security-banner"
      >
        <div className="flex items-center gap-2">
          <LockKeyhole className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium">キーの保存について</span>
        </div>
        <p className="text-sm text-muted-foreground">
          入力した API キーは、この端末のブラウザ（localStorage）にのみ保存されます。Notea
          のサーバーには送信・保存されません。
        </p>
        <p className="text-sm text-muted-foreground">
          PC とスマホなど、端末ごとに別々に登録が必要です。ブラウザのデータを消去するとキーも削除されます。
        </p>
        <a
          href="/help#api-key"
          className="text-sm text-primary underline-offset-2 hover:underline self-start"
        >
          詳しくはヘルプをご覧ください →
        </a>
      </div>

      {/* プロバイダカード */}
      <div className="flex flex-col gap-4">
        {AI_PROVIDERS.map((provider) => (
          <AiKeyManager key={provider} provider={provider} plan={plan} />
        ))}
      </div>
    </div>
  )
}
