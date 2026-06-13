import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPage } from '@/lib/queries/pages'
import { PageView } from '@/components/page/PageView'
import { displayTitle } from '@/lib/utils/page-display'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const page = await getPage(id)
  return {
    title: page ? `${displayTitle(page.title)} | Notea` : 'ページ | Notea',
    robots: { index: false },
  }
}

export default async function PageDetailPage({ params }: Props) {
  const { id } = await params
  const page = await getPage(id)

  if (!page) {
    notFound()
  }

  return <PageView page={page} />
}
