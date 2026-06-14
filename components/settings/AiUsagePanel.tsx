'use client'

import { Sparkles } from 'lucide-react'
import { useAiUsage } from '@/hooks/use-ai-usage'
import { ROUTES } from '@/lib/constants/routes'
import Link from 'next/link'

type AiUsagePanelProps = {
  /** SSR で取得した初期値（Client 側の再取得まで表示） */
  initialRemaining: number
  initialLimit: number
  initialPlan: 'free' | 'paid'
}

export function AiUsagePanel({ initialRemaining, initialLimit, initialPlan }: AiUsagePanelProps) {
  const { remaining, limit, totalUsed, plan } = useAiUsage()

  const displayRemaining = remaining ?? initialRemaining
  const displayLimit = limit ?? initialLimit
  const displayPlan = plan ?? initialPlan
  const displayUsed = totalUsed ?? (initialLimit - initialRemaining)

  const progressPct = displayLimit > 0 ? Math.min(100, (displayUsed / displayLimit) * 100) : 0
  const planLabel = displayPlan === 'paid' ? 'プレミアムプラン' : '無料プラン'

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium">今日の AI 残回数</span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">
          {displayUsed} / {displayLimit} 回（{planLabel}）
        </span>
        <span className="text-muted-foreground text-xs">毎日 0 時（JST）にリセット</span>
      </div>

      {/* プログレスバー */}
      <div
        className="h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={displayUsed}
        aria-valuemin={0}
        aria-valuemax={displayLimit}
        aria-label={`AI 使用回数: ${displayUsed} / ${displayLimit}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <p className="text-sm text-foreground">残り {displayRemaining} 回使用できます</p>

      {displayPlan === 'free' && (
        <p className="text-xs text-muted-foreground">
          上限を増やしたい場合は{' '}
          <Link
            href={ROUTES.SETTINGS}
            className="text-primary underline-offset-2 hover:underline"
          >
            プレミアムプランへのアップグレード
          </Link>
          をご検討ください（100 回/日）。
        </p>
      )}
    </div>
  )
}
