'use client'

import { AlertCircle, Check, Loader2 } from 'lucide-react'
import type { AutosaveStatus } from '@/hooks/use-autosave'

type AutoSaveStatusProps = {
  status: AutosaveStatus
  onRetry: () => void
}

export function AutoSaveStatus({ status, onRetry }: AutoSaveStatusProps) {
  if (status === 'idle') return null

  const isError = status === 'error'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      data-testid="autosave-status"
      className="flex items-center gap-1.5 text-sm transition-opacity duration-200"
    >
      {status === 'saving' && (
        <>
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">保存中…</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <Check className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">保存済み</span>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="size-3.5 text-destructive" aria-hidden="true" />
          <span className="text-destructive">保存に失敗しました</span>
          <button
            onClick={onRetry}
            aria-label="自動保存を再試行"
            data-testid="autosave-retry"
            className="text-sm text-primary underline-offset-2 hover:underline ml-1"
          >
            再試行
          </button>
        </>
      )}
    </div>
  )
}
