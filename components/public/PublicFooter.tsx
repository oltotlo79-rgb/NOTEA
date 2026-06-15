import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'

export function PublicFooter() {
  return (
    <footer className="border-t border-border py-8">
      <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center gap-4 justify-between">
        <span className="text-sm font-semibold">Notea</span>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link href={ROUTES.TERMS} className="hover:text-foreground transition-colors">
            利用規約
          </Link>
          <Link href={ROUTES.PRIVACY} className="hover:text-foreground transition-colors">
            プライバシーポリシー
          </Link>
          <Link href={ROUTES.TOKUSHOHO} className="hover:text-foreground transition-colors">
            特定商取引法に基づく表記
          </Link>
          <Link href={ROUTES.HELP} className="hover:text-foreground transition-colors">
            ヘルプ
          </Link>
        </nav>
      </div>
    </footer>
  )
}
