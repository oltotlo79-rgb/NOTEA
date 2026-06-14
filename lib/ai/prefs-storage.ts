/**
 * @module lib/ai/prefs-storage
 * AI 機能の UI 設定（最後に使った翻訳言語ペアなど）を localStorage に保存する。
 * API キーは key-storage.ts に分離している。
 */

import { AI_LAST_TRANSLATE_LANG_KEY } from '@/lib/constants/ai'
import type { TranslateLangPair } from '@/lib/ai/types'

const DEFAULT_LANG_PAIR: TranslateLangPair = { source: '日本語', target: '英語' }

export function getLastTranslateLang(): TranslateLangPair {
  if (typeof window === 'undefined') return DEFAULT_LANG_PAIR
  const stored = localStorage.getItem(AI_LAST_TRANSLATE_LANG_KEY)
  if (!stored) return DEFAULT_LANG_PAIR
  try {
    const parsed: unknown = JSON.parse(stored)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'source' in parsed &&
      'target' in parsed &&
      typeof (parsed as Record<string, unknown>).source === 'string' &&
      typeof (parsed as Record<string, unknown>).target === 'string'
    ) {
      return parsed as TranslateLangPair
    }
    return DEFAULT_LANG_PAIR
  } catch {
    return DEFAULT_LANG_PAIR
  }
}

export function setLastTranslateLang(pair: TranslateLangPair): void {
  localStorage.setItem(AI_LAST_TRANSLATE_LANG_KEY, JSON.stringify(pair))
}
