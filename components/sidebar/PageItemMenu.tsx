'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { MoreHorizontal, FilePlus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePageMutations } from '@/hooks/use-page-mutations'
import { ROUTES } from '@/lib/constants/routes'

type PageItemMenuProps = {
  pageId: string
  onRenameStart: () => void
}

export function PageItemMenu({ pageId, onRenameStart }: PageItemMenuProps) {
  const router = useRouter()
  const { create, trash } = usePageMutations()
  const [isPending, startTransition] = useTransition()

  const handleAddSubPage = () => {
    startTransition(async () => {
      const result = await create({ parentId: pageId })
      if (result.success && result.data) {
        router.push(`${ROUTES.PAGES}/${result.data.id}`)
      }
    })
  }

  const handleTrash = async () => {
    await trash(pageId)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover/page-item:opacity-100 shrink-0"
            aria-label="ページメニュー"
          />
        }
        onClick={(e) => e.preventDefault()}
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start">
        <DropdownMenuItem onClick={handleAddSubPage} disabled={isPending}>
          <FilePlus className="size-4" />
          サブページを追加
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRenameStart}>
          <Pencil className="size-4" />
          名前を変更
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={handleTrash}>
          <Trash2 className="size-4" />
          ごみ箱に移動
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
