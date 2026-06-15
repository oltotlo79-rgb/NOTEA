/**
 * prefs-storage.ts のユニットテスト。
 * 翻訳言語ペアの保存・読み出しをテストする。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Node.js 25 は native localStorage を持つが clear() が無い。Map ベースのモックで統一する。
function makeMockLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value) }),
    removeItem: vi.fn((key: string) => { store.delete(key) }),
    clear: vi.fn(() => { store.clear() }),
    get length() { return store.size },
    key: vi.fn((i: number) => [...store.keys()][i] ?? null),
    _store: store,
  }
}

let mockStorage: ReturnType<typeof makeMockLocalStorage>

beforeEach(async () => {
  mockStorage = makeMockLocalStorage()
  vi.stubGlobal('localStorage', mockStorage)
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getLastTranslateLang', () => {
  it('未設定の場合はデフォルト（日本語→英語）を返す', async () => {
    const { getLastTranslateLang } = await import('@/lib/ai/prefs-storage')
    const result = getLastTranslateLang()
    expect(result.source).toBe('日本語')
    expect(result.target).toBe('英語')
  })

  it('設定済みの値を返す', async () => {
    const { getLastTranslateLang, setLastTranslateLang } = await import('@/lib/ai/prefs-storage')
    setLastTranslateLang({ source: '英語', target: '日本語' })
    const result = getLastTranslateLang()
    expect(result.source).toBe('英語')
    expect(result.target).toBe('日本語')
  })

  it('不正な JSON が保存されていてもデフォルトを返す', async () => {
    mockStorage._store.set('notea_ai_last_translate_lang', 'invalid-json')
    const { getLastTranslateLang } = await import('@/lib/ai/prefs-storage')
    const result = getLastTranslateLang()
    expect(result.source).toBe('日本語')
    expect(result.target).toBe('英語')
  })

  it('source/target が文字列でない場合はデフォルトを返す', async () => {
    mockStorage._store.set('notea_ai_last_translate_lang', JSON.stringify({ source: 1, target: 2 }))
    const { getLastTranslateLang } = await import('@/lib/ai/prefs-storage')
    const result = getLastTranslateLang()
    expect(result.source).toBe('日本語')
    expect(result.target).toBe('英語')
  })
})

describe('setLastTranslateLang', () => {
  it('保存した値が次回の getLastTranslateLang で取得できる', async () => {
    const { getLastTranslateLang, setLastTranslateLang } = await import('@/lib/ai/prefs-storage')
    setLastTranslateLang({ source: 'フランス語', target: '日本語' })
    const result = getLastTranslateLang()
    expect(result.source).toBe('フランス語')
    expect(result.target).toBe('日本語')
  })

  it('上書き保存が機能する', async () => {
    const { getLastTranslateLang, setLastTranslateLang } = await import('@/lib/ai/prefs-storage')
    setLastTranslateLang({ source: '日本語', target: '英語' })
    setLastTranslateLang({ source: '英語', target: '中国語' })
    const result = getLastTranslateLang()
    expect(result.source).toBe('英語')
    expect(result.target).toBe('中国語')
  })
})
