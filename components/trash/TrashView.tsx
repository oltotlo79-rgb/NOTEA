'use client'

import { useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useTrashedPages } from '@/hooks/use-trashed-pages'
import { usePageMutations } from '@/hooks/use-page-mutations'
import { displayTitle } from '@/lib/utils/page-display'

export function TrashView() {
  const { items, isLoading, error, loadMore, hasMore } = useTrashedPages()
  const { restore, deletePermanently } = usePageMutations()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isDeletePending, setIsDeletePending] = useState(false)

  const handleRestore = async (id: string) => {
    await restore(id)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return
    setIsDeletePending(true)
    await deletePermanently(deleteTargetId)
    setIsDeletePending(false)
    setDeleteTargetId(null)
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-4/5" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="p-4 text-sm text-destructive">ごみ箱の読み込みに失敗しました</p>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Trash2 className="size-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">ごみ箱は空です</p>
      </div>
    )
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-base leading-none shrink-0">
              {item.icon ?? '📄'}
            </span>
            <span className="flex-1 min-w-0 truncate text-sm">
              {displayTitle(item.title)}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {new Date(item.trashed_at).toLocaleDateString('ja-JP')}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRestore(item.id)}
                aria-label="復元"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeleteTargetId(item.id)}
                aria-label="完全に削除"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="flex justify-center p-4">
          <Button variant="outline" onClick={loadMore}>
            もっと見る
          </Button>
        </div>
      )}

      <Dialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>完全に削除しますか？</DialogTitle>
            <DialogDescription>
              このページとすべてのサブページが完全に削除されます。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" />}
              disabled={isDeletePending}
            >
              キャンセル
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeletePending}
            >
              完全に削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
