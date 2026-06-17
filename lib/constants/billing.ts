/**
 * @module lib/constants/billing
 * プラン定義。価格 ID は環境変数（Stripe ダッシュボードで作成した価格の ID）。
 * 表示価格は要件定義書 3.6.1。
 */

export const BILLING_PLANS = ['monthly', 'yearly'] as const
export type BillingPlan = (typeof BILLING_PLANS)[number]

export const PLAN_DISPLAY = {
  monthly: { label: '月額プラン', price: '¥300', period: '月', note: '' },
  yearly: { label: '年額プラン', price: '¥3,000', period: '年', note: '2ヶ月分お得' },
} as const

/** プランごとの Stripe 価格 ID を返す環境変数名 */
export const PLAN_PRICE_ENV: Record<BillingPlan, string> = {
  monthly: 'STRIPE_PRICE_MONTHLY',
  yearly: 'STRIPE_PRICE_YEARLY',
}
