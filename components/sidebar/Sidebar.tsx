'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import Link from 'next/link'
import { Plus, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { PageTree } from './PageTree'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { usePageMutations } from '@/hooks/use-page-mutations'
import { ROUTES } from '@/lib/constants/routes'

type SidebarProps = {
  userEmail?: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const router = useRouter()
  const { create } = usePageMutations()
  const [isPending, startTransition] = useTransition()

  const handleCreatePage = () => {
    startTransition(async () => {
      const result = await create({})
      if (result.success && result.data) {
        router.push(`${ROUTES.PAGES}/${result.data.id}`)
      }
    })
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-semibold text-foreground">Notea</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleCreatePage}
          disabled={isPending}
          aria-label="新規ページを作成"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 py-2">
        <PageTree onCreatePage={handleCreatePage} />
      </ScrollArea>

      <Separator />

      <div className="flex flex-col gap-1 p-2">
        <Link
          href={ROUTES.TRASH}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Trash2 className="size-4" />
          ごみ箱
        </Link>
        <Link
          href={ROUTES.SETTINGS}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings className="size-4" />
          設定
        </Link>
        {userEmail && (
          <p className="truncate px-2 py-1 text-xs text-muted-foreground">
            {userEmail}
          </p>
        )}
        <SignOutButton />
      </div>
    </div>
  )
}
