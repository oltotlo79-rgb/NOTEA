import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'

export default function SharedNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">共有リンクが見つかりません</h1>
      <p className="text-sm text-muted-foreground">
        このリンクは無効になったか、削除された可能性があります。
      </p>
      <Link
        href={ROUTES.HOME}
        className="text-sm text-primary underline-offset-2 hover:underline"
      >
        Notea のトップへ
      </Link>
    </div>
  )
}
