/**
 * @module lib/ai/key-storage
 * AI API キーの唯一の保存・読出し点。localStorage のみを使い、サーバーに渡さない。
 *
 * cookie に保存しない理由: cookie は毎リクエストで自動的にサーバーへ送信されるため、
 * 「ブラウザにのみ保存する」という BYOK の根幹が崩れる。
 */

import type { AiProvider } from '@/lib/constants/limits/ai'
import { AI_KEY_STORAGE_KEYS } from '@/lib/constants/ai'

export function getKey(provider: AiProvider): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AI_KEY_STORAGE_KEYS[provider])
}

export function setKey(provider: AiProvider, key: string): void {
  localStorage.setItem(AI_KEY_STORAGE_KEYS[provider], key)
}

export function removeKey(provider: AiProvider): void {
  localStorage.removeItem(AI_KEY_STORAGE_KEYS[provider])
}

export function hasKey(provider: AiProvider): boolean {
  return getKey(provider) !== null
}
