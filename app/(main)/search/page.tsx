import type { Metadata } from 'next'
import { SearchView } from '@/components/search/SearchView'

export const metadata: Metadata = {
  title: '検索 | Notea',
  robots: { index: false, follow: false },
}

export default function SearchPage() {
  return <SearchView />
}
