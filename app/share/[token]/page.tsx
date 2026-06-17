import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getSharedPage } from '@/lib/actions/shared-pages'
import { createClient } from '@/lib/supabase/server'
import { SharedPageView } from '@/components/share/SharedPageView'
import { displayTitle } from '@/lib/utils/page-display'
import { ROUTES } from '@/lib/constants/routes'

type Props = {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const { data: page } = await getSharedPage(token)
  return {
    title: page ? `${displayTitle(page.title)} | Notea` : '共有ページ | Notea',
    // アプリ内/共有ページはインデックスさせない
    robots: { index: false, follow: false },
  }
}

export default async function SharedPage({ params }: Props) {
  const { token } = await params
  const { data: page } = await getSharedPage(token)

  if (!page) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const canEdit = page.permission === 'edit' && user !== null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <Link href={ROUTES.HOME} className="text-sm font-semibold text-foreground">
          Notea
        </Link>
        {user ? (
          <Link
            href={ROUTES.PAGES}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            マイページ
          </Link>
        ) : (
          <Link
            href={ROUTES.LOGIN}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ログイン
          </Link>
        )}
      </header>

      <main className="flex-1 overflow-auto py-2">
        <SharedPageView token={token} page={page} canEdit={canEdit} />
      </main>
    </div>
  )
}
