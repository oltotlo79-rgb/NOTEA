'use client'

/**
 * @module components/editor/AutoSaveContext
 * 自動保存の状態をエディタページから AppShell トップバーへ伝えるための Context。
 * Props スロットの代わりに Context を選択した理由:
 * AppShell は pages/[id] 以外のページでも使われるため、props にスロットを追加すると
 * 全ページで undefined を渡す定型コードが増える。Context なら未設定時は null のまま。
 */
import { createContext, useCallback, useContext, useState } from 'react'
import type { AutosaveStatus } from '@/hooks/use-autosave'

type AutoSaveContextValue = {
  status: AutosaveStatus
  setStatus: (status: AutosaveStatus) => void
  onRetry: () => void
  setOnRetry: (fn: () => void) => void
}

const AutoSaveContext = createContext<AutoSaveContextValue | null>(null)

export function AutoSaveProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [onRetryFn, setOnRetryFn] = useState<(() => void) | null>(null)

  const setOnRetry = useCallback((fn: () => void) => {
    setOnRetryFn(() => fn)
  }, [])

  const onRetry = useCallback(() => {
    onRetryFn?.()
  }, [onRetryFn])

  return (
    <AutoSaveContext.Provider value={{ status, setStatus, onRetry, setOnRetry }}>
      {children}
    </AutoSaveContext.Provider>
  )
}

export function useAutoSaveContext(): AutoSaveContextValue | null {
  return useContext(AutoSaveContext)
}
