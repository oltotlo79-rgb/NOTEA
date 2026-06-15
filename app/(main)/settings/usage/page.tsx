import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getPageCount, getStorageUsage, getAiUsageToday } from '@/lib/services/usage'
import { UsageMeter } from '@/components/settings/UsageMeter'
import { AiUsagePanel } from '@/components/settings/AiUsagePanel'
import { formatStorageSize } from '@/lib/utils/storage'
import { ROUTES } from '@/lib/constants/routes'
import {
  FREE_MAX_PAGES,
  FREE_MAX_STORAGE_MB,
  PAID_MAX_STORAGE_GB,
  FREE_AI_DAILY_LIMIT,
  PAID_AI_DAILY_LIMIT,
} from '@/lib/constants/limits'

export const metadata: Metadata = {
  title: '使用量 | Notea',
  robots: { index: false },
}

const BYTES_PER_MB = 1024 * 1024
const BYTES_PER_GB = 1024 * 1024 * 1024

export default async function UsageSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  const plan: 'free' | 'paid' = profile?.plan === 'paid' ? 'paid' : 'free'

  const [pageCount, storageUsage, aiUsage] = await Promise.all([
    getPageCount(user.id),
    getStorageUsage(user.id),
    getAiUsageToday(user.id),
  ])

  const pageLimit = plan === 'paid' ? null : FREE_MAX_PAGES
  const storageLimitBytes = plan === 'paid'
    ? PAID_MAX_STORAGE_GB * BYTES_PER_GB
    : FREE_MAX_STORAGE_MB * BYTES_PER_MB

  const aiLimit = plan === 'paid' ? PAID_AI_DAILY_LIMIT : FREE_AI_DAILY_LIMIT
  const aiTotalUsed = aiUsage.providers.reduce((sum, p) => sum + p.count, 0)
  const aiRemaining = Math.max(0, aiLimit - aiTotalUsed)

  const storageFormatted = formatStorageSize(storageUsage.usedBytes)
  const storageLimitFormatted = formatStorageSize(storageLimitBytes)

  const planLabel = plan === 'paid' ? 'プレミアムプラン' : '無料プラン'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* モバイル: 戻るリンク */}
      <div className="flex items-center gap-3 md:hidden">
        <Link
          href={ROUTES.SETTINGS}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← 設定
        </Link>
      </div>

      <h1 className="text-2xl font-bold">使用量</h1>

      {/* ページ数 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">ページ数</h2>
        {plan === 'paid' ? (
          <p className="text-sm text-muted-foreground">
            {pageCount} ページ（プレミアムプラン・無制限）
          </p>
        ) : (
          <UsageMeter
            label="ページ数"
            used={pageCount}
            limit={pageLimit ?? FREE_MAX_PAGES}
            unit="ページ"
            formattedUsed={String(pageCount)}
            formattedLimit={String(FREE_MAX_PAGES)}
            planLabel={planLabel}
            testId="usage-pages-meter"
          />
        )}
      </section>

      {/* ストレージ */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">ストレージ</h2>
        <UsageMeter
          label="ストレージ"
          used={storageUsage.usedBytes}
          limit={storageLimitBytes}
          unit={storageLimitFormatted.unit}
          formattedUsed={`${storageFormatted.value} ${storageFormatted.unit}`}
          formattedLimit={`${storageLimitFormatted.value} ${storageLimitFormatted.unit}`}
          planLabel={planLabel}
          testId="usage-storage-meter"
        />
      </section>

      {/* AI 残回数 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">本日の AI 残回数</h2>
        <AiUsagePanel
          initialRemaining={aiRemaining}
          initialLimit={aiLimit}
          initialPlan={plan}
        />
      </section>

      {/* アップグレード案内（無料プランのみ） */}
      {plan === 'free' && (
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            上限を増やしたい場合は{' '}
            <Link
              href={ROUTES.SETTINGS}
              className="text-primary underline-offset-2 hover:underline"
            >
              プレミアムプランをご検討ください
            </Link>
            。（ページ無制限・ストレージ {PAID_MAX_STORAGE_GB}GB・AI {PAID_AI_DAILY_LIMIT}回/日）
          </p>
        </div>
      )}
    </div>
  )
}
