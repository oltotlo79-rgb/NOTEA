'use client'

import { usePathname } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { PageTreeItem } from './PageTreeItem'
import { usePageTree } from '@/hooks/use-page-tree'
import { buildPageTree } from '@/lib/services/page-tree'
import { ROUTES } from '@/lib/constants/routes'

type PageTreeProps = {
  onCreatePage?: () => void
}

export function PageTree({ onCreatePage }: PageTreeProps) {
  const { data: pages, isLoading, error } = usePageTree()
  const pathname = usePathname()

  const currentPageId = pathname.startsWith(`${ROUTES.PAGES}/`)
    ? pathname.slice(`${ROUTES.PAGES}/`.length)
    : undefined

  if (isLoading) {
    return (
      <div className="space-y-1 px-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-6 w-3/5" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="px-3 py-2 text-xs text-destructive">ページツリーの読み込みに失敗しました</p>
    )
  }

  const tree = buildPageTree(pages ?? [])

  if (tree.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-xs text-muted-foreground">ページがありません</p>
        {onCreatePage && (
          <button
            onClick={onCreatePage}
            className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
          >
            最初のページを作成
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-px">
      {tree.map((node) => (
        <PageTreeItem key={node.id} node={node} currentPageId={currentPageId} />
      ))}
    </div>
  )
}
