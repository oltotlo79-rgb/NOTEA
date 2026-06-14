'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { AiResultPreview } from '@/components/ai/AiResultPreview'
import { useAiUsage } from '@/hooks/use-ai-usage'
import { useHasAnyKey } from '@/hooks/use-ai-key'
import { consumeAiUsage } from '@/lib/actions/ai'
import { generateWithSelectedProvider, selectProvider } from '@/lib/ai/index'
import { getLastTranslateLang, setLastTranslateLang } from '@/lib/ai/prefs-storage'
import type { AiOperation } from '@/lib/ai/types'
import type { AiProvider } from '@/lib/constants/limits/ai'
import { ROUTES } from '@/lib/constants/routes'
import {
  ERR_AI_KEY_NOT_FOUND,
  ERR_AI_DAILY_LIMIT_FREE,
  ERR_AI_DAILY_LIMIT_PAID,
  ERR_AI_KEY_INVALID,
  ERR_AI_NETWORK,
  ERR_AI_RATE_LIMITED,
  ERR_AI_EMPTY_CONTENT,
} from '@/lib/constants/errors'
import { FREE_AI_DAILY_LIMIT, PAID_AI_DAILY_LIMIT } from '@/lib/constants/limits/ai'

type AiMenuProps = {
  pageContentText: string
  selectedText?: string
  onAskPanelOpen: () => void
  /** 要約・続き書きの結果をページ末尾 or カーソル後に挿入する */
  onInsertText: (text: string) => void
  /** 翻訳の結果で選択範囲を置換する */
  onReplaceText: (text: string) => void
  /** トースト表示用コールバック */
  onToast: (message: string, actionLabel?: string, actionHref?: string) => void
  /** ボタンの表示形態 */
  variant?: 'toolbar' | 'mobile-header'
}

const TRANSLATE_PRESETS = [
  { source: '日本語', target: '英語' },
  { source: '英語', target: '日本語' },
]

export function AiMenu({
  pageContentText,
  selectedText,
  onAskPanelOpen,
  onInsertText,
  onReplaceText,
  onToast,
  variant = 'toolbar',
}: AiMenuProps) {
  const { remaining, plan, refetch } = useAiUsage()
  const hasAnyKey = useHasAnyKey()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<AiOperation>('summarize')
  const [stream, setStream] = useState<ReadableStream<string> | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [targetLang, setTargetLang] = useState<string | undefined>()
  const [sourceLang, setSourceLang] = useState<string | undefined>()
  const [customLangInput, setCustomLangInput] = useState('')
  const [showCustomLangInput, setShowCustomLangInput] = useState(false)

  const checkGuards = useCallback(
    (operation: AiOperation): boolean => {
      if (!hasAnyKey) {
        onToast(ERR_AI_KEY_NOT_FOUND, 'キーを登録する', `${ROUTES.SETTINGS}/ai`)
        return false
      }
      if (remaining === 0) {
        const msg =
          plan === 'paid'
            ? ERR_AI_DAILY_LIMIT_PAID(PAID_AI_DAILY_LIMIT)
            : ERR_AI_DAILY_LIMIT_FREE(FREE_AI_DAILY_LIMIT)
        const actionLabel = plan === 'free' ? 'プランを確認する' : undefined
        const actionHref = plan === 'free' ? ROUTES.SETTINGS : undefined
        onToast(msg, actionLabel, actionHref)
        return false
      }
      if (
        (operation === 'summarize' || operation === 'continue') &&
        !pageContentText.trim() &&
        !selectedText?.trim()
      ) {
        onToast(ERR_AI_EMPTY_CONTENT)
        return false
      }
      return true
    },
    [hasAnyKey, remaining, plan, pageContentText, selectedText, onToast]
  )

  const runAiOperation = useCallback(
    async (
      operation: AiOperation,
      opts?: { sourceLang?: string; targetLang?: string }
    ) => {
      if (!checkGuards(operation)) return

      const provider = selectProvider()
      if (!provider) {
        onToast(ERR_AI_KEY_NOT_FOUND, 'キーを登録する', `${ROUTES.SETTINGS}/ai`)
        return
      }

      const operationText =
        operation === 'translate'
          ? selectedText ?? ''
          : selectedText?.trim()
          ? selectedText
          : pageContentText

      setCurrentOperation(operation)
      setTargetLang(opts?.targetLang)
      setSourceLang(opts?.sourceLang)
      setStream(null)
      setErrorMessage(undefined)
      setPreviewOpen(true)

      // Gemini / Anthropic: consumeAiUsage を先に呼ぶ（二重カウント防止）
      // OpenAI: proxy 側で消費するため Action 呼び出しをスキップ
      if (provider !== 'openai') {
        const consumeResult = await consumeAiUsage(provider as Exclude<AiProvider, 'openai'>)
        if (!consumeResult.success) {
          setErrorMessage(consumeResult.error)
          setPreviewOpen(true)
          void refetch()
          return
        }
        void refetch()
      }

      const dispatchResult = await generateWithSelectedProvider({
        operation,
        text: operationText,
        sourceLang: opts?.sourceLang,
        targetLang: opts?.targetLang,
        signal: undefined,
      })

      if ('error' in dispatchResult) {
        setErrorMessage(ERR_AI_KEY_NOT_FOUND)
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
        setErrorMessage(msg)
        return
      }

      setStream(result.stream)
    },
    [
      checkGuards,
      selectedText,
      pageContentText,
      onToast,
      refetch,
    ]
  )

  const handleSummarize = useCallback(() => {
    void runAiOperation('summarize')
  }, [runAiOperation])

  const handleContinue = useCallback(() => {
    void runAiOperation('continue')
  }, [runAiOperation])

  const handleTranslate = useCallback(
    (src: string, tgt: string) => {
      if (!selectedText?.trim()) {
        onToast('翻訳するテキストを選択してください')
        return
      }
      setLastTranslateLang({ source: src, target: tgt })
      void runAiOperation('translate', { sourceLang: src, targetLang: tgt })
    },
    [selectedText, onToast, runAiOperation]
  )

  const handleCustomTranslate = useCallback(() => {
    if (!customLangInput.trim()) return
    const lastLang = getLastTranslateLang()
    handleTranslate(lastLang.source, customLangInput.trim())
    setCustomLangInput('')
    setShowCustomLangInput(false)
  }, [customLangInput, handleTranslate])

  const handleInsert = useCallback(
    (text: string) => {
      onInsertText(text)
      setPreviewOpen(false)
    },
    [onInsertText]
  )

  const handleReplace = useCallback(
    (text: string) => {
      onReplaceText(text)
      setPreviewOpen(false)
    },
    [onReplaceText]
  )

  const handleDiscard = useCallback(() => {
    setPreviewOpen(false)
    setStream(null)
    setErrorMessage(undefined)
  }, [])

  const handleRetry = useCallback(() => {
    setStream(null)
    setErrorMessage(undefined)
    void runAiOperation(currentOperation, { sourceLang, targetLang })
  }, [currentOperation, sourceLang, targetLang, runAiOperation])

  const buttonClassName =
    variant === 'mobile-header'
      ? 'flex items-center gap-1 text-sm font-medium text-primary'
      : 'flex items-center gap-1 text-xs font-medium text-primary'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label="AI メニューを開く"
              aria-haspopup="true"
              data-testid="ai-menu-button"
              className={buttonClassName}
            />
          }
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          <span>AI</span>
          <ChevronDown className="size-3" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          role="menu"
          aria-label="AI 操作"
          data-testid="ai-dropdown-menu"
          side="bottom"
          align="end"
          className="w-52"
        >
          <DropdownMenuItem
            role="menuitem"
            data-testid="ai-menu-summarize"
            onClick={handleSummarize}
          >
            要約する
          </DropdownMenuItem>

          <DropdownMenuItem
            role="menuitem"
            data-testid="ai-menu-continue"
            onClick={handleContinue}
          >
            続きを書く
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              role="menuitem"
              data-testid="ai-menu-translate"
              aria-haspopup="true"
            >
              翻訳する
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              data-testid="ai-submenu-translate"
            >
              {TRANSLATE_PRESETS.map(({ source, target }) => (
                <DropdownMenuItem
                  key={`${source}-${target}`}
                  onClick={() => handleTranslate(source, target)}
                >
                  {source} → {target}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowCustomLangInput((v) => !v)}
              >
                その他の言語を指定
              </DropdownMenuItem>
              {showCustomLangInput && (
                <div className="px-2 py-1">
                  <input
                    autoFocus
                    value={customLangInput}
                    onChange={(e) => setCustomLangInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCustomTranslate()
                    }}
                    placeholder="例: フランス語、中国語"
                    className="w-full rounded border border-input bg-transparent px-2 py-1 text-xs outline-none focus:border-ring"
                  />
                </div>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            role="menuitem"
            data-testid="ai-menu-ask"
            onClick={onAskPanelOpen}
          >
            このページに質問する
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AiResultPreview
        open={previewOpen}
        operation={currentOperation}
        stream={stream}
        errorMessage={errorMessage}
        targetLanguage={targetLang}
        sourceText={currentOperation === 'translate' ? selectedText : undefined}
        onInsert={handleInsert}
        onReplace={handleReplace}
        onDiscard={handleDiscard}
        onRetry={handleRetry}
      />
    </>
  )
}
