import type { Metadata } from 'next'
import Link from 'next/link'
import { User, BarChart2, Sun, Sparkles, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = {
  title: '設定 | Notea',
  robots: { index: false },
}

const SETTING_CARDS = [
  {
    href: ROUTES.SETTINGS_PROFILE,
    icon: User,
    title: 'プロフィール',
    description: '表示名など',
  },
  {
    href: ROUTES.SETTINGS_USAGE,
    icon: BarChart2,
    title: '使用量',
    description: 'ページ・容量',
  },
  {
    href: ROUTES.SETTINGS_APPEARANCE,
    icon: Sun,
    title: '外観',
    description: 'テーマ',
  },
  {
    href: ROUTES.SETTINGS_AI,
    icon: Sparkles,
    title: 'AI キー管理',
    description: 'API キー登録',
  },
  {
    href: ROUTES.SETTINGS_ACCOUNT,
    icon: Trash2,
    title: 'アカウント',
    description: '削除など',
  },
]

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">設定</h1>

      {/* モバイル: 設定ナビ（md 未満で表示） */}
      <nav aria-label="設定メニュー" className="flex flex-col gap-2 md:hidden">
        {SETTING_CARDS.map(({ href, icon: Icon, title }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">{title}</span>
            </div>
            <span className="text-muted-foreground text-sm" aria-hidden="true">›</span>
          </Link>
        ))}
      </nav>

      {/* デスクトップ: カードグリッド（md 以上で表示） */}
      <div className="hidden md:grid grid-cols-2 gap-4">
        {SETTING_CARDS.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href} className="group">
            <Card className="hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer h-full">
              <CardHeader>
                <Icon className="size-5 text-muted-foreground mb-2" aria-hidden="true" />
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
