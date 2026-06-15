'use client'

import { useQuery } from '@tanstack/react-query'
import { getAiUsageToday } from '@/lib/actions/ai'
import { FREE_AI_DAILY_LIMIT } from '@/lib/constants/limits'

type AiUsageData = Awaited<ReturnType<typeof getAiUsageToday>>

/** getAiUsageToday Server Action を React Query でラップする。 */
export function useAiUsage() {
  const { data, isLoading, refetch } = useQuery<AiUsageData>({
    queryKey: ['ai-usage-today'],
    queryFn: () => getAiUsageToday(),
    staleTime: 30_000,
  })

  const plan = data?.plan ?? 'free'
  const limit = data?.limit ?? FREE_AI_DAILY_LIMIT
  const totalUsed = data?.providers.reduce((sum, p) => sum + p.count, 0) ?? 0
  const remaining = Math.max(0, limit - totalUsed)

  return {
    plan,
    limit,
    totalUsed,
    remaining,
    isLoading,
    /** AI 操作後に手動で残回数を再取得する */
    refetch,
  }
}
