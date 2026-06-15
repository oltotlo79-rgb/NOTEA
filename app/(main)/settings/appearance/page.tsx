import type { Metadata } from 'next'
import Link from 'next/link'
import { ThemeSelector } from '@/components/settings/ThemeSelector'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = {
  title: '外観 | Notea',
  robots: { index: false },
}

export default function AppearanceSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* モバイル: 戻るリンク */}
      <div className="flex items-center gap-3 md:hidden">
        <Link
          href={ROUTES.SETTINGS}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← 設定
        </Link>
      </div>

      <h1 className="text-2xl font-bold">外観</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">テーマ</h2>
        <ThemeSelector />
        <p className="text-sm text-muted-foreground">
          システムは OS の設定に合わせて自動的に切り替わります。
        </p>
      </section>
    </div>
  )
}
