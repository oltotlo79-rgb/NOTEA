/**
 * key-storage.ts のユニットテスト。
 * localStorage のみを使う（cookie / サーバー通信なし）ことを検証する。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})

describe('key-storage - getKey / setKey', () => {
  it('setKey で保存した値を getKey で取得できる', async () => {
    const { getKey, setKey } = await import('@/lib/ai/key-storage')
    setKey('gemini', 'AIzaSy-test-key-1234')
    expect(getKey('gemini')).toBe('AIzaSy-test-key-1234')
  })

  it('setKey は provider 別に独立して保存する', async () => {
    const { getKey, setKey } = await import('@/lib/ai/key-storage')
    setKey('gemini', 'AIzaSy-gemini-key')
    setKey('openai', 'sk-openai-key')
    setKey('anthropic', 'sk-ant-anthropic-key')

    expect(getKey('gemini')).toBe('AIzaSy-gemini-key')
    expect(getKey('openai')).toBe('sk-openai-key')
    expect(getKey('anthropic')).toBe('sk-ant-anthropic-key')
  })

  it('未設定の provider は null を返す', async () => {
    const { getKey } = await import('@/lib/ai/key-storage')
    expect(getKey('openai')).toBeNull()
  })

  it('localStorage のキー名が定数 AI_KEY_STORAGE_KEYS と一致する', async () => {
    const { setKey } = await import('@/lib/ai/key-storage')
    setKey('gemini', 'AIzaSy-key')
    expect(localStorage.getItem(AI_KEY_STORAGE_KEYS['gemini'])).toBe('AIzaSy-key')

    setKey('openai', 'sk-key')
    expect(localStorage.getItem(AI_KEY_STORAGE_KEYS['openai'])).toBe('sk-key')

    setKey('anthropic', 'sk-ant-key')
    expect(localStorage.getItem(AI_KEY_STORAGE_KEYS['anthropic'])).toBe('sk-ant-key')
  })
})

describe('key-storage - removeKey', () => {
  it('removeKey で保存した鍵を削除できる', async () => {
    const { getKey, setKey, removeKey } = await import('@/lib/ai/key-storage')
    setKey('gemini', 'AIzaSy-test')
    removeKey('gemini')
    expect(getKey('gemini')).toBeNull()
  })

  it('removeKey は該当 provider のみ削除し他に影響しない', async () => {
    const { getKey, setKey, removeKey } = await import('@/lib/ai/key-storage')
    setKey('gemini', 'AIzaSy-gemini')
    setKey('openai', 'sk-openai')
    removeKey('gemini')

    expect(getKey('gemini')).toBeNull()
    expect(getKey('openai')).toBe('sk-openai')
  })

  it('存在しない provider を removeKey しても例外が発生しない', async () => {
    const { removeKey } = await import('@/lib/ai/key-storage')
    expect(() => removeKey('anthropic')).not.toThrow()
  })
})

describe('key-storage - hasKey', () => {
  it('鍵が設定済みなら true を返す', async () => {
    const { setKey, hasKey } = await import('@/lib/ai/key-storage')
    setKey('gemini', 'AIzaSy-key')
    expect(hasKey('gemini')).toBe(true)
  })

  it('鍵が未設定なら false を返す', async () => {
    const { hasKey } = await import('@/lib/ai/key-storage')
    expect(hasKey('openai')).toBe(false)
  })

  it('削除後は false を返す', async () => {
    const { setKey, removeKey, hasKey } = await import('@/lib/ai/key-storage')
    setKey('anthropic', 'sk-ant-key')
    removeKey('anthropic')
    expect(hasKey('anthropic')).toBe(false)
  })
})

describe('key-storage - localStorage のみを使う（サーバー非送信の保証）', () => {
  it('setKey は localStorage.setItem を呼ぶ（cookieには保存しない）', async () => {
    const { setKey } = await import('@/lib/ai/key-storage')
    setKey('gemini', 'AIzaSy-secret-key')
    // localStorage.setItem が呼ばれていることを確認
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      AI_KEY_STORAGE_KEYS['gemini'],
      'AIzaSy-secret-key'
    )
    // sessionStorage は別モックなので呼ばれていない
    const sessionMock = vi.fn()
    vi.stubGlobal('sessionStorage', { getItem: sessionMock, setItem: sessionMock })
    expect(sessionMock).not.toHaveBeenCalled()
  })

  it('sessionStorage には保存されない（localStorage のみ）', async () => {
    const sessionStoreMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    }
    vi.stubGlobal('sessionStorage', sessionStoreMock)

    const { setKey } = await import('@/lib/ai/key-storage')
    setKey('openai', 'sk-secret-key')

    // sessionStorage には書き込まれていない
    expect(sessionStoreMock.setItem).not.toHaveBeenCalled()
  })
})

describe('key-storage - window undefined 環境（SSR 模擬）', () => {
  it('SSR 環境（window undefined）では getKey が null を返す', async () => {
    // window を undefined にして SSR 状態を模擬
    vi.stubGlobal('window', undefined)
    const { getKey } = await import('@/lib/ai/key-storage')
    expect(getKey('gemini')).toBeNull()
    // window を復元（他テストに影響しないよう）
    vi.unstubAllGlobals()
    vi.stubGlobal('localStorage', mockStorage)
  })
})
