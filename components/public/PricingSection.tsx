import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ROUTES } from '@/lib/constants/routes'
import {
  FREE_MAX_PAGES,
  FREE_MAX_STORAGE_MB,
  FREE_AI_DAILY_LIMIT,
  PAID_MAX_STORAGE_GB,
  PAID_AI_DAILY_LIMIT,
} from '@/lib/constants/limits'

const FREE_FEATURES = [
  `ページ ${FREE_MAX_PAGES} まで`,
  `画像 ${FREE_MAX_STORAGE_MB} MB まで`,
  `Gemini のみ ${FREE_AI_DAILY_LIMIT}回/日`,
]

const PAID_FEATURES = [
  'ページ 無制限',
  `画像 ${PAID_MAX_STORAGE_GB} GB`,
  `全 AI ${PAID_AI_DAILY_LIMIT}回/日`,
]

export function PricingSection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 無料プラン */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">無料</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="text-foreground">・</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button render={<Link href={ROUTES.REGISTER} data-testid="pricing-free-cta" />}>
                無料で始める
              </Button>
            </CardContent>
          </Card>

          {/* プレミアムプラン */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                プレミアム{' '}
                <span className="text-base font-normal text-muted-foreground">¥300/月</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">（年払い ¥3,000）</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {PAID_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="text-foreground">・</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">（第2弾リリース予定）</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
