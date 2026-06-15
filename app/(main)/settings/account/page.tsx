import type { Metadata } from 'next'
import Link from 'next/link'
import { DeleteAccountButton } from '@/components/settings/DeleteAccountButton'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = {
  title: 'アカウント | Notea',
  robots: { index: false },
}

export default function AccountSettingsPage() {
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

      <h1 className="text-2xl font-bold">アカウント</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">アカウントを削除</h2>

        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex flex-col gap-4">
          <p className="text-sm text-foreground">
            アカウントを削除すると、すべてのページ・画像・データが完全に削除されます。この操作は取り消せません。
          </p>
          <DeleteAccountButton />
        </div>
      </section>
    </div>
  )
}
