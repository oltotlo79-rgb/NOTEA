'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { Lock, Pencil } from 'lucide-react'
import { SharedEditorDynamic } from './SharedEditorDynamic'
import { AutoSaveStatus } from '@/components/editor/AutoSaveStatus'
import { useAutosave } from '@/hooks/use-autosave'
import { updateSharedPageContent, type SharedPage } from '@/lib/actions/shared-pages'
import { displayTitle } from '@/lib/utils/page-display'
import { ROUTES } from '@/lib/constants/routes'

type SharedPageViewProps = {
  token: string
  page: SharedPage
  /** permission==='edit' かつ閲覧者がログイン済みのときのみ true */
  canEdit: boolean
}

export function SharedPageView({ token, page, canEdit }: SharedPageViewProps) {
  const save = useCallback(
    (content: unknown[], contentText: string) =>
      updateSharedPageContent({ token, content, contentText }),
    [token]
  )

  const { status, saveNow, onContentChange } = useAutosave({ save })

  const showLoginPrompt = page.permission === 'edit' && !canEdit

  return (
    <div className="mx-auto w-full max-w-[900px]">
      {canEdit && (
        <div className="flex items-center justify-end gap-2 px-8 pt-4 text-xs text-muted-foreground">
          <Pencil className="size-3.5" />
          <span>共有編集中</span>
          <AutoSaveStatus status={status} onRetry={saveNow} />
        </div>
      )}

      {showLoginPrompt && (
        <div className="mx-8 mt-4 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          <span>
            このページは編集可能な共有リンクです。編集するには
            <Link href={ROUTES.LOGIN} className="mx-1 text-primary underline-offset-2 hover:underline">
              ログイン
            </Link>
            してください。
          </span>
        </div>
      )}

      {/* ヘッダ（読取専用） */}
      <div className="px-8 pt-8 pb-4">
        <div className="mb-3 text-4xl leading-none">{page.icon ?? '📄'}</div>
        <h1 className="text-3xl font-bold break-words">{displayTitle(page.title)}</h1>
      </div>

      <SharedEditorDynamic
        token={token}
        initialContent={page.content}
        editable={canEdit}
        onContentChange={canEdit ? onContentChange : undefined}
      />
    </div>
  )
}
