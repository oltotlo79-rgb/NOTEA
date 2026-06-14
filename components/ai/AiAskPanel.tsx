'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Sparkles, X, Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { consumeAiUsage } from '@/lib/actions/ai'
import { generateWithSelectedProvider, selectProvider } from '@/lib/ai/index'
import { useAiUsage } from '@/hooks/use-ai-usage'
import { useHasAnyKey } from '@/hooks/use-ai-key'
import { ROUTES } from '@/lib/constants/routes'
import {
  ERR_AI_KEY_NOT_FOUND,
  ERR_AI_DAILY_LIMIT_FREE,
  ERR_AI_DAILY_LIMIT_PAID,
  ERR_AI_KEY_INVALID,
  ERR_AI_NETWORK,
  ERR_AI_RATE_LIMITED,
} from '@/lib/constants/errors'
import { FREE_AI_DAILY_LIMIT, PAID_AI_DAILY_LIMIT } from '@/lib/constants/limits/ai'
import type { AiProvider } from '@/lib/constants/limits/ai'
import Link from 'next/link'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type AskPanelState = 'idle' | 'sending' | 'streaming' | 'done' | 'error'

type AiAskPanelProps = {
  pageContentText: string
  isOpen: boolean
  onClose: () => void
}

/** デスクトップ用の右パネル。モバイルは Sheet ラッパー経由で使う。 */
function AskPanelContent({
  pageContentText,
  onClose,
}: {
  pageContentText: string
  onClose: () => void
}) {
  const { remaining, plan, refetch } = useAiUsage()
  const hasAnyKey = useHasAnyKey()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [panelState, setPanelState] = useState<AskPanelState>('idle')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 新しいメッセージが追加されたら最下部へスクロール
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // パネルが開いたとき入力欄にフォーカス
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setPanelState('done')
  }, [])

  const handleSend = useCallback(async () => {
    const question = input.trim()
    if (!question || panelState === 'sending' || panelState === 'streaming') return
    setInlineError(null)

    if (!hasAnyKey) {
      setInlineError(ERR_AI_KEY_NOT_FOUND)
      return
    }
    if (remaining === 0) {
      setInlineError(
        plan === 'paid'
          ? ERR_AI_DAILY_LIMIT_PAID(PAID_AI_DAILY_LIMIT)
          : ERR_AI_DAILY_LIMIT_FREE(FREE_AI_DAILY_LIMIT)
      )
      return
    }

    const provider = selectProvider()
    if (!provider) {
      setInlineError(ERR_AI_KEY_NOT_FOUND)
      return
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setPanelState('sending')

    // Gemini / Anthropic: consumeAiUsage を先に呼ぶ
    if (provider !== 'openai') {
      const consumeResult = await consumeAiUsage(provider as Exclude<AiProvider, 'openai'>)
      if (!consumeResult.success) {
        setInlineError(consumeResult.error)
        setPanelState('error')
        void refetch()
        return
      }
      void refetch()
    }

    const abort = new AbortController()
    abortRef.current = abort

    const dispatchResult = await generateWithSelectedProvider({
      operation: 'ask',
      text: pageContentText,
      question,
      signal: abort.signal,
    })

    if ('error' in dispatchResult) {
      setInlineError(ERR_AI_KEY_NOT_FOUND)
      setPanelState('error')
      return
    }

    const { result } = dispatchResult
    if (!result.ok) {
      const msg =
        result.error.kind === 'key_invalid'
          ? ERR_AI_KEY_INVALID
          : result.error.kind === 'rate_limited'
          ? ERR_AI_RATE_LIMITED
          : ERR_AI_NETWORK
      setInlineError(msg)
      setPanelState('error')
      return
    }

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMessage])
    setPanelState('streaming')

    const reader = result.stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id ? { ...m, content: m.content + value } : m
          )
        )
      }
      setPanelState('done')
    } catch {
      setPanelState('error')
      setInlineError(ERR_AI_NETWORK)
    } finally {
      inputRef.current?.focus()
    }
  }, [input, panelState, hasAnyKey, remaining, plan, pageContentText, refetch])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const isBusy = panelState === 'sending' || panelState === 'streaming'

  return (
    <div
      className="flex flex-col h-full"
      data-testid="ai-ask-panel"
    >
      {/* ヘッダ */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <span>AI — このページに質問する</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="質問パネルを閉じる"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* 回答エリア */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            質問すると、ページの内容をもとに回答します。
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-foreground">
                    {msg.role === 'user' ? 'あなた' : '✦ AI'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {msg.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        )}
        <div ref={scrollEndRef} />
      </ScrollArea>

      {/* インラインエラー */}
      {inlineError && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-xs text-destructive">
            {inlineError}
            {inlineError === ERR_AI_KEY_NOT_FOUND && (
              <> <Link href={`${ROUTES.SETTINGS}/ai`} className="underline">設定を開く</Link></>
            )}
          </p>
        </div>
      )}

      {/* 入力欄 */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="質問を入力…"
            rows={1}
            disabled={isBusy}
            data-testid="ai-ask-input"
            aria-label="質問入力欄"
            className="flex-1 resize-none overflow-auto min-h-[36px] max-h-[72px] rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          {isBusy ? (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleStop}
              data-testid="ai-ask-submit"
              aria-label="生成を停止"
            >
              <Square className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon-sm"
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              data-testid="ai-ask-submit"
              aria-label="質問を送信"
            >
              <Send className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function AiAskPanel({ pageContentText, isOpen, onClose }: AiAskPanelProps) {
  return (
    <>
      {/* デスクトップ: 右パネル */}
      <div
        className={`hidden md:flex flex-col w-80 border-l border-border bg-background transition-all duration-200 ${
          isOpen ? 'flex' : 'hidden'
        }`}
        aria-hidden={!isOpen}
      >
        {isOpen && (
          <AskPanelContent pageContentText={pageContentText} onClose={onClose} />
        )}
      </div>

      {/* モバイル: Sheet ドロワー */}
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent side="bottom" className="h-[70vh] p-0 md:hidden" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>AI 質問パネル</SheetTitle>
          </SheetHeader>
          <AskPanelContent pageContentText={pageContentText} onClose={onClose} />
        </SheetContent>
      </Sheet>
    </>
  )
}
