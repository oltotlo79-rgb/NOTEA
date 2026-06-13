'use client'

import { useCallback, useEffect } from 'react'
import { PageHeader } from './PageHeader'
import { EditorDynamic } from '@/components/editor/EditorDynamic'
import { useAutosave } from '@/hooks/use-autosave'
import { useAutoSaveContext } from '@/components/editor/AutoSaveContext'
import type { PageDetail } from '@/lib/queries/pages'

type PageViewProps = {
  page: PageDetail
}

export function PageView({ page }: PageViewProps) {
  const { status, saveNow, onContentChange } = useAutosave({ pageId: page.id })
  const autoSaveCtx = useAutoSaveContext()
  // Context に状態と再試行ハンドラを登録する
  useEffect(() => {
    autoSaveCtx?.setStatus(status)
  }, [status, autoSaveCtx])

  useEffect(() => {
    autoSaveCtx?.setOnRetry(saveNow)
  }, [saveNow, autoSaveCtx])

  const handleTitleEnterPress = useCallback(() => {
    // タイトルで Enter を押したとき、エディタへフォーカスを移す。
    // BlockNote は最初のブロックにフォーカスする手段が現時点で API 非公開のため
    // エディタルート要素の contenteditable 要素にフォーカスする。
    const editorRoot = document.querySelector<HTMLElement>('[data-testid="editor-root"] .bn-editor')
    editorRoot?.focus()
  }, [])

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="max-w-[900px] mx-auto w-full">
        <PageHeader
          pageId={page.id}
          title={page.title}
          icon={page.icon}
          onEnterPress={handleTitleEnterPress}
        />
        <EditorDynamic
          pageId={page.id}
          initialContent={page.content}
          onContentChange={onContentChange}
        />
      </div>
    </div>
  )
}
