import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'

export default function PageNotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
      <p className="text-lg font-medium">ページが見つかりません</p>
      <p className="text-sm text-muted-foreground">
        削除されたか、URLが正しくない可能性があります
      </p>
      <Link
        href={ROUTES.PAGES}
        className="text-sm text-primary underline-offset-2 hover:underline"
      >
        ページ一覧に戻る
      </Link>
    </div>
  )
}
