'use client'

import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { useAiUsage } from '@/hooks/use-ai-usage'

/**
 * @module components/ai/AiUsageBadge
 * エディタページのトップバーに表示する AI 残回数バッジ。
 * ゼロ時は destructive 色で警告する。
 */
export function AiUsageBadge() {
  const { remaining, limit, isLoading } = useAiUsage()

  if (isLoading) return null

  const isExhausted = remaining === 0

  return (
    <Link
      href={`${ROUTES.SETTINGS}/ai`}
      data-testid="ai-usage-badge"
      aria-label={`本日の AI 残回数: ${remaining} 回`}
      className={`text-xs transition-colors hover:underline underline-offset-2 ${
        isExhausted ? 'text-destructive' : 'text-muted-foreground'
      }`}
    >
      本日 {remaining}/{limit} 回
    </Link>
  )
}
