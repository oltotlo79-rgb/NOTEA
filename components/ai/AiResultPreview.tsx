'use client'

import { useEffect, useRef, useMemo } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { AiOperation } from '@/lib/ai/types'
import { ERR_AI_NETWORK } from '@/lib/constants/errors'
import { useStreamReader } from '@/hooks/use-stream-reader'

type AiResultPreviewProps = {
  open: boolean
  operation: AiOperation
  /** ストリーミング取得用 ReadableStream（親から渡す） */
  stream: ReadableStream<string> | null
  /** エラー時のメッセージ */
  errorMessage?: string
  /** 翻訳時のターゲット言語 */
  targetLanguage?: string
  /** 翻訳時の元テキスト（差分表示用） */
  sourceText?: string
  onInsert: (text: string) => void
  onReplace: (text: string) => void
  onDiscard: () => void
  onRetry: () => void
}

const OPERATION_TITLES: Record<AiOperation, string> = {
  summarize: '✦ 要約',
  continue: '✦ 続きを書く',
  translate: '✦ 翻訳',
  ask: '✦ 回答',
}

export function AiResultPreview({
  open,
  operation,
  stream,
  errorMessage,
  targetLanguage,
  sourceText,
  onInsert,
  onReplace,
  onDiscard,
  onRetry,
}: AiResultPreviewProps) {
  const { text: generatedText, status: streamStatus } = useStreamReader(
    open ? stream : null,
    open ? errorMessage : undefined
  )
  const discardButtonRef = useRef<HTMLButtonElement>(null)

  const title =
    operation === 'translate' && targetLanguage
      ? `✦ 翻訳（→ ${targetLanguage}）`
      : OPERATION_TITLES[operation]

  const isDone = streamStatus === 'done'

  // 完了時に「破棄」ボタンにフォーカス（誤挿入防止）
  useEffect(() => {
    if (open && isDone) {
      discardButtonRef.current?.focus()
    }
  }, [open, isDone])

  const isGenerating = streamStatus === 'idle' || streamStatus === 'streaming'
  const isError = streamStatus === 'error'

  const applyLabel = useMemo(() => {
    if (operation === 'summarize') return 'ページ末尾に挿入'
    if (operation === 'continue') return 'カーソル位置に挿入'
    return '選択範囲を置換'
  }, [operation])

  function handleApply() {
    if (operation === 'translate') {
      onReplace(generatedText)
    } else {
      onInsert(generatedText)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onDiscard() }}>
      <DialogContent
        showCloseButton
        className="max-w-2xl"
        data-testid="ai-result-preview"
        role="dialog"
        aria-labelledby="ai-result-title"
        aria-modal="true"
      >
        <DialogHeader>
          <DialogTitle id="ai-result-title">{title}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-1">
          {/* 翻訳の場合のみ元テキスト引用を表示 */}
          {operation === 'translate' && sourceText && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">元のテキスト</p>
              <p className="text-sm text-muted-foreground italic border-l-2 border-border pl-3">
                {sourceText}
              </p>
              {targetLanguage && (
                <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">
                  翻訳結果（{targetLanguage}）
                </p>
              )}
            </div>
          )}

          {streamStatus === 'idle' && !errorMessage && (
            <div
              className="flex items-center gap-2 py-4 text-muted-foreground"
              aria-busy="true"
              aria-label="AI が生成中です"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span className="text-sm">生成中...</span>
            </div>
          )}

          {(streamStatus === 'streaming' || streamStatus === 'done') && (
            <p
              className="text-sm whitespace-pre-wrap text-foreground leading-relaxed"
              data-testid="ai-result-text"
            >
              {generatedText}
              {streamStatus === 'streaming' && (
                <span className="animate-pulse" aria-hidden="true">|</span>
              )}
            </p>
          )}

          {isError && (
            <div className="flex flex-col gap-3 py-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-sm">{errorMessage ?? ERR_AI_NETWORK}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                data-testid="ai-result-retry"
                className="self-start"
              >
                再試行
              </Button>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="-mx-4 -mb-4 flex flex-row justify-end gap-2 border-t bg-muted/50 px-4 py-3 rounded-b-xl sm:flex-row sm:justify-end">
          <Button
            ref={discardButtonRef}
            variant="outline"
            size="sm"
            onClick={onDiscard}
            data-testid="ai-result-discard"
          >
            破棄
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
            disabled={isGenerating || isError}
            data-testid="ai-result-apply"
          >
            {applyLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
