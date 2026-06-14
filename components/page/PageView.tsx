'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from './PageHeader'
import { EditorDynamic } from '@/components/editor/EditorDynamic'
import { AiAskPanel } from '@/components/ai/AiAskPanel'
import { AiMenu } from '@/components/ai/AiMenu'
import { useAutosave } from '@/hooks/use-autosave'
import { useAutoSaveContext } from '@/components/editor/AutoSaveContext'
import type { PageDetail } from '@/lib/queries/pages'

type ToastInfo = {
  id: string
  message: string
  actionLabel?: string
  actionHref?: string
}

type PageViewProps = {
  page: PageDetail
}

export function PageView({ page }: PageViewProps) {
  const { status, saveNow, onContentChange } = useAutosave({ pageId: page.id })
  const autoSaveCtx = useAutoSaveContext()
  const router = useRouter()
  const [isAskPanelOpen, setIsAskPanelOpen] = useState(false)
  const [pageContentText, setPageContentText] = useState('')
  const [toasts, setToasts] = useState<ToastInfo[]>([])

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

  const handleContentChange = useCallback(
    (content: unknown[], contentText: string) => {
      setPageContentText(contentText)
      onContentChange(content, contentText)
    },
    [onContentChange]
  )

  const handleToast = useCallback(
    (message: string, actionLabel?: string, actionHref?: string) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, message, actionLabel, actionHref }])
      // 5秒後に自動削除
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 5000)
    },
    []
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      {/* メインエディタ領域 */}
      <div className="flex flex-col flex-1 overflow-auto">
        <div className="max-w-[900px] mx-auto w-full">
          <div className="relative">
            <PageHeader
              pageId={page.id}
              title={page.title}
              icon={page.icon}
              onEnterPress={handleTitleEnterPress}
              aiMenuSlot={
                <div className="md:hidden">
                  <AiMenu
                    pageContentText={pageContentText}
                    onAskPanelOpen={() => setIsAskPanelOpen(true)}
                    onInsertText={() => {}}
                    onReplaceText={() => {}}
                    onToast={handleToast}
                    variant="mobile-header"
                  />
                </div>
              }
            />
          </div>
          <EditorDynamic
            pageId={page.id}
            initialContent={page.content}
            onContentChange={handleContentChange}
            pageContentText={pageContentText}
            onAskPanelOpen={() => setIsAskPanelOpen(true)}
            onToast={handleToast}
          />
        </div>
      </div>

      {/* AI 質問サイドパネル（デスクトップ右パネル + モバイル Sheet） */}
      <AiAskPanel
        pageContentText={pageContentText}
        isOpen={isAskPanelOpen}
        onClose={() => setIsAskPanelOpen(false)}
      />

      {/* トースト通知 */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-md px-4">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-popover px-4 py-3 shadow-lg text-sm"
              role="alert"
            >
              <span className="text-foreground">{toast.message}</span>
              <div className="flex items-center gap-2 shrink-0">
                {toast.actionLabel && toast.actionHref && (
                  <button
                    onClick={() => {
                      dismissToast(toast.id)
                      router.push(toast.actionHref!)
                    }}
                    className="text-primary text-xs underline-offset-2 hover:underline"
                  >
                    {toast.actionLabel}
                  </button>
                )}
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                  aria-label="閉じる"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
