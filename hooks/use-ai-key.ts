'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { AiProvider } from '@/lib/constants/limits/ai'
import { AI_PROVIDERS } from '@/lib/constants/limits/ai'
import { setKey, removeKey } from '@/lib/ai/key-storage'
import { AI_KEY_STORAGE_KEYS } from '@/lib/constants/ai'

type UseAiKeyReturn = {
  hasKey: boolean
  /** 登録済み鍵の末尾4文字表示用マスク文字列（例: "••••••abcd"） */
  maskedKey: string | null
  register: (key: string) => void
  remove: () => void
}

/**
 * localStorage の変更を購読するための subscribe/getSnapshot ペア。
 * useSyncExternalStore を使い、SSR ではサーバースナップショットを返す（null 固定）。
 */
function subscribeToStorage(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getStorageKey(provider: AiProvider): string | null {
  return localStorage.getItem(AI_KEY_STORAGE_KEYS[provider])
}

/** key-storage.ts のラッパー。React state と localStorage を同期する。 */
export function useAiKey(provider: AiProvider): UseAiKeyReturn {
  const storedKey = useSyncExternalStore<string | null>(
    subscribeToStorage,
    () => getStorageKey(provider),
    () => null
  )

  const maskedKey = storedKey
    ? `${'•'.repeat(Math.max(0, storedKey.length - 4))}${storedKey.slice(-4)}`
    : null

  const register = useCallback(
    (key: string) => {
      setKey(provider, key)
      // storage イベントは同一タブでは発火しないため手動でトリガー
      window.dispatchEvent(new StorageEvent('storage', { key: AI_KEY_STORAGE_KEYS[provider] }))
    },
    [provider]
  )

  const remove = useCallback(() => {
    removeKey(provider)
    window.dispatchEvent(new StorageEvent('storage', { key: AI_KEY_STORAGE_KEYS[provider] }))
  }, [provider])

  return {
    hasKey: storedKey !== null,
    maskedKey,
    register,
    remove,
  }
}

/** 少なくとも1つのプロバイダに鍵が登録されているかを返す */
export function useHasAnyKey(): boolean {
  return useSyncExternalStore<boolean>(
    subscribeToStorage,
    () => AI_PROVIDERS.some((p) => localStorage.getItem(AI_KEY_STORAGE_KEYS[p]) !== null),
    () => false
  )
}
