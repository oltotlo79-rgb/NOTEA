import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getMostRecentPageId } from '@/lib/queries/pages'
import { CreateFirstPageButton } from '@/components/page/CreateFirstPageButton'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = {
  title: 'ページ | Notea',
  robots: { index: false },
}

export default async function PagesHomePage() {
  const recentId = await getMostRecentPageId()

  if (recentId) {
    redirect(`${ROUTES.PAGES}/${recentId}`)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
      <p className="text-muted-foreground text-sm">まだページがありません</p>
      <CreateFirstPageButton />
    </div>
  )
}
