/**
 * hooks/use-ai-key.ts のユニットテスト。
 * useSyncExternalStore で localStorage の変更を React state に同期する。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AI_KEY_STORAGE_KEYS } from '@/lib/constants/ai'

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
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAiKey', () => {
  it('鍵が未登録なら hasKey=false、maskedKey=null を返す', async () => {
    const { useAiKey } = await import('@/hooks/use-ai-key')
    const { result } = renderHook(() => useAiKey('gemini'))
    expect(result.current.hasKey).toBe(false)
    expect(result.current.maskedKey).toBeNull()
  })

  it('register で鍵を登録すると hasKey=true になる', async () => {
    const { useAiKey } = await import('@/hooks/use-ai-key')
    const { result } = renderHook(() => useAiKey('gemini'))

    act(() => {
      result.current.register('AIzaSy-test-key-1234')
    })

    expect(result.current.hasKey).toBe(true)
  })

  it('register で登録した鍵は maskedKey として末尾4文字が見える', async () => {
    const { useAiKey } = await import('@/hooks/use-ai-key')
    const { result } = renderHook(() => useAiKey('gemini'))

    act(() => {
      result.current.register('AIzaSy-test-key-abcd')
    })

    expect(result.current.maskedKey).toContain('abcd')
    expect(result.current.maskedKey).toMatch(/^•+abcd$/)
  })

  it('remove で鍵を削除すると hasKey=false、maskedKey=null になる', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-test-key')
    const { useAiKey } = await import('@/hooks/use-ai-key')
    const { result } = renderHook(() => useAiKey('gemini'))

    act(() => {
      result.current.remove()
    })

    expect(result.current.hasKey).toBe(false)
    expect(result.current.maskedKey).toBeNull()
  })

  it('openai の鍵は gemini に影響しない', async () => {
    const { useAiKey } = await import('@/hooks/use-ai-key')
    const { result: geminiResult } = renderHook(() => useAiKey('gemini'))
    const { result: openaiResult } = renderHook(() => useAiKey('openai'))

    act(() => {
      openaiResult.current.register('sk-openai-key')
    })

    expect(geminiResult.current.hasKey).toBe(false)
    expect(openaiResult.current.hasKey).toBe(true)
  })

  it('4文字以下の鍵でも maskedKey が正しく生成される', async () => {
    const { useAiKey } = await import('@/hooks/use-ai-key')
    const { result } = renderHook(() => useAiKey('gemini'))

    act(() => {
      result.current.register('abcd')
    })

    expect(result.current.maskedKey).toBe('abcd')
  })
})

describe('useHasAnyKey', () => {
  it('どのプロバイダも登録されていなければ false を返す', async () => {
    const { useHasAnyKey } = await import('@/hooks/use-ai-key')
    const { result } = renderHook(() => useHasAnyKey())
    expect(result.current).toBe(false)
  })

  it('1つでも登録されていれば true を返す', async () => {
    const { useHasAnyKey } = await import('@/hooks/use-ai-key')
    const { result } = renderHook(() => useHasAnyKey())

    act(() => {
      mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-key')
      window.dispatchEvent(new StorageEvent('storage'))
    })

    expect(result.current).toBe(true)
  })
})
