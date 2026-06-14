'use client'

/**
 * @module components/settings/AiKeyManager
 * プロバイダ別 AI API キー管理カード。
 * 鍵の保存・読み出しは lib/ai/key-storage.ts のみを経由する。
 * 登録時のテスト呼び出し: Gemini/Anthropic はブラウザ直接（consumeAiUsage を消費しない）、
 * OpenAI は CORS 非対応かつ proxy 経由だと consumeAiUsage が消費されるため形式チェックのみ。
 */

import { useState, useCallback } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAiKey } from '@/hooks/use-ai-key'
import type { AiProvider } from '@/lib/constants/limits/ai'
import {
  AI_PROVIDER_DISPLAY_NAMES,
  AI_KEY_PREFIXES,
  AI_KEY_GET_URLS,
  AI_DEFAULT_MODELS,
} from '@/lib/constants/ai'
import { ERR_AI_KEY_FORMAT } from '@/lib/constants/errors'

type AiKeyManagerProps = {
  provider: AiProvider
  plan: 'free' | 'paid'
}

type RegisterState = 'idle' | 'validating' | 'error_format' | 'error_invalid'

async function testGeminiKey(key: string, model: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] }),
      }
    )
    return res.ok || res.status === 400
  } catch {
    return false
  }
}

async function testAnthropicKey(key: string, model: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // Anthropic はこのヘッダが無いとブラウザ直接呼び出しを CORS で拒否する
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    })
    return res.ok || res.status === 400
  } catch {
    return false
  }
}

export function AiKeyManager({ provider, plan }: AiKeyManagerProps) {
  const { hasKey, maskedKey, register, remove } = useAiKey(provider)
  const [inputValue, setInputValue] = useState('')
  const [registerState, setRegisterState] = useState<RegisterState>('idle')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const displayName = AI_PROVIDER_DISPLAY_NAMES[provider]
  const prefix = AI_KEY_PREFIXES[provider]
  const keyGetUrl = AI_KEY_GET_URLS[provider]
  const planLabel =
    provider === 'gemini' ? '無料・有料プランで利用可能' : '有料プランで利用可能'

  const handleRegister = useCallback(async () => {
    const trimmed = inputValue.trim()
    if (!trimmed.startsWith(prefix)) {
      setRegisterState('error_format')
      return
    }

    setRegisterState('validating')

    // テスト呼び出し（Gemini / Anthropic はブラウザ直接）
    // OpenAI は CORS 非対応のため形式チェックのみとする
    let isValid = true
    if (provider === 'gemini') {
      isValid = await testGeminiKey(trimmed, AI_DEFAULT_MODELS.gemini)
    } else if (provider === 'anthropic') {
      isValid = await testAnthropicKey(trimmed, AI_DEFAULT_MODELS.anthropic)
    }
    // openai: 形式チェックのみ（CORS 非対応かつ proxy 経由は consumeAiUsage を消費してしまうため）

    if (!isValid) {
      setRegisterState('error_invalid')
      return
    }

    register(trimmed)
    setInputValue('')
    setRegisterState('idle')
  }, [inputValue, prefix, provider, register])

  const handleDelete = useCallback(() => {
    remove()
    setDeleteDialogOpen(false)
  }, [remove])

  const isValidating = registerState === 'validating'

  // 無料プランで OpenAI/Anthropic は非表示（Hook を条件分岐より後に置けないため、ここで早期 return）
  if (plan === 'free' && provider !== 'gemini') {
    return null
  }

  return (
    <>
      <Card data-testid={`ai-key-manager-${provider}`}>
        <CardHeader>
          <CardTitle>{displayName}</CardTitle>
          <CardDescription>{planLabel}</CardDescription>
          {hasKey && (
            <CardAction>
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                <Check className="size-3.5" aria-hidden="true" />
                登録済み
              </span>
            </CardAction>
          )}
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">API キー</p>

            {hasKey ? (
              <div className="flex gap-2 items-center">
                <Input
                  type="text"
                  value={maskedKey ?? ''}
                  readOnly
                  aria-label={`${displayName} API キー（末尾4文字表示）`}
                  aria-readonly="true"
                  data-testid={`ai-key-input-${provider}`}
                  className="font-mono text-sm"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  data-testid={`ai-key-delete-${provider}`}
                >
                  削除
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2 items-center">
                  <Input
                    type="password"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value)
                      setRegisterState('idle')
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleRegister() }}
                    placeholder="キーを貼り付け"
                    autoComplete="off"
                    aria-label={`${displayName} API キー`}
                    aria-invalid={
                      registerState === 'error_format' || registerState === 'error_invalid'
                    }
                    data-testid={`ai-key-input-${provider}`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => void handleRegister()}
                    disabled={isValidating || !inputValue.trim()}
                    data-testid={`ai-key-register-${provider}`}
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        登録中...
                      </>
                    ) : (
                      '登録'
                    )}
                  </Button>
                </div>

                {(registerState === 'error_format' || registerState === 'error_invalid') && (
                  <div className="flex items-center gap-1 text-destructive text-sm">
                    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    <span>
                      {registerState === 'error_format'
                        ? ERR_AI_KEY_FORMAT
                        : 'このキーは無効です。正しい API キーを確認してから再入力してください。'}
                    </span>
                  </div>
                )}
              </div>
            )}

            <a
              href={keyGetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline-offset-2 hover:underline self-start mt-1"
            >
              {displayName} API キーの取得方法 →
            </a>
          </div>
        </CardContent>
      </Card>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent
          data-testid="ai-key-delete-confirm-dialog"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>{displayName} API キーを削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            この端末から {displayName} の API キーが削除されます。AI 機能が利用できなくなります。
          </p>
          <DialogFooter className="-mx-4 -mb-4 flex flex-row justify-end gap-2 border-t bg-muted/50 px-4 py-3 rounded-b-xl sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              data-testid="ai-key-delete-confirm-submit"
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
