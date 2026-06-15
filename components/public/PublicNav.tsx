import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'

export function PublicNav() {
  return (
    <header className="h-14 border-b border-border bg-background">
      <div className="max-w-5xl mx-auto h-full flex items-center justify-between px-4">
        <Link href={ROUTES.HOME} className="text-base font-bold">
          Notea
        </Link>
        <nav className="flex items-center gap-3">
          <Button variant="ghost" render={<Link href={ROUTES.LOGIN} />}>
            ログイン
          </Button>
          <Button render={<Link href={ROUTES.REGISTER} />}>
            無料で始める
          </Button>
        </nav>
      </div>
    </header>
  )
}
