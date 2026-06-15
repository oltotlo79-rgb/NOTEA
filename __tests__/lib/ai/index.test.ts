/**
 * lib/ai/index.ts のユニットテスト。
 * プロバイダ自動選択・ディスパッチロジックをテストする。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_KEY_STORAGE_KEYS } from '@/lib/constants/ai'

// provider の generate をモック
vi.mock('@/lib/ai/providers/gemini', () => ({
  generate: vi.fn(),
}))
vi.mock('@/lib/ai/providers/openai', () => ({
  generate: vi.fn(),
}))
vi.mock('@/lib/ai/providers/anthropic', () => ({
  generate: vi.fn(),
}))

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

beforeEach(() => {
  mockStorage = makeMockLocalStorage()
  vi.stubGlobal('localStorage', mockStorage)
  vi.resetModules()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('selectProvider', () => {
  it('鍵が登録されていない場合は null を返す', async () => {
    const { selectProvider } = await import('@/lib/ai/index')
    expect(selectProvider()).toBeNull()
  })

  it('gemini が登録済みなら gemini を返す', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-key')
    const { selectProvider } = await import('@/lib/ai/index')
    expect(selectProvider()).toBe('gemini')
  })

  it('最後に使ったプロバイダを優先する', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-key')
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['openai'], 'sk-key')
    const { selectProvider, setLastUsedProvider } = await import('@/lib/ai/index')
    setLastUsedProvider('openai')

    expect(selectProvider()).toBe('openai')
  })

  it('最後に使ったプロバイダの鍵が削除されたら登録済みの最初のものを返す', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-key')
    const { selectProvider, setLastUsedProvider } = await import('@/lib/ai/index')
    setLastUsedProvider('openai') // openai の鍵は未登録

    expect(selectProvider()).toBe('gemini')
  })
})

describe('getLastUsedProvider / setLastUsedProvider', () => {
  it('setLastUsedProvider で保存した値を getLastUsedProvider で取得できる', async () => {
    const { getLastUsedProvider, setLastUsedProvider } = await import('@/lib/ai/index')
    setLastUsedProvider('anthropic')
    expect(getLastUsedProvider()).toBe('anthropic')
  })

  it('未設定の場合は null を返す', async () => {
    const { getLastUsedProvider } = await import('@/lib/ai/index')
    expect(getLastUsedProvider()).toBeNull()
  })

  it('無効な値が保存されていた場合は null を返す', async () => {
    mockStorage._store.set('notea_ai_last_provider', 'invalid_provider')
    const { getLastUsedProvider } = await import('@/lib/ai/index')
    expect(getLastUsedProvider()).toBeNull()
  })
})

describe('generateWithSelectedProvider', () => {
  it('鍵が未登録なら error: no_key を返す', async () => {
    const { generateWithSelectedProvider } = await import('@/lib/ai/index')
    const result = await generateWithSelectedProvider({ operation: 'summarize', text: 'test' })
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('no_key')
    }
  })

  it('gemini が登録済みなら gemini で generate を呼ぶ', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-gemini-key')
    const { generateWithSelectedProvider } = await import('@/lib/ai/index')
    const { generate: mockGeminiGenerate } = await import('@/lib/ai/providers/gemini')
    vi.mocked(mockGeminiGenerate).mockResolvedValueOnce({
      ok: true,
      stream: new ReadableStream<string>(),
    })

    const result = await generateWithSelectedProvider({ operation: 'summarize', text: 'test' })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.provider).toBe('gemini')
      expect(mockGeminiGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'summarize' }),
        'AIzaSy-gemini-key'
      )
    }
  })

  it('openai が選択されたら openai で generate を呼ぶ', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['openai'], 'sk-openai-key')
    const { generateWithSelectedProvider, setLastUsedProvider } = await import('@/lib/ai/index')
    const { generate: mockOpenaiGenerate } = await import('@/lib/ai/providers/openai')
    const { generate: mockGeminiGenerate } = await import('@/lib/ai/providers/gemini')
    setLastUsedProvider('openai')
    vi.mocked(mockOpenaiGenerate).mockResolvedValueOnce({
      ok: true,
      stream: new ReadableStream<string>(),
    })

    const result = await generateWithSelectedProvider({ operation: 'continue', text: 'test' })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.provider).toBe('openai')
      expect(mockOpenaiGenerate).toHaveBeenCalled()
      expect(mockGeminiGenerate).not.toHaveBeenCalled()
    }
  })

  it('anthropic が選択されたら anthropic で generate を呼ぶ', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['anthropic'], 'sk-ant-key')
    const { generateWithSelectedProvider, setLastUsedProvider } = await import('@/lib/ai/index')
    const { generate: mockAnthropicGenerate } = await import('@/lib/ai/providers/anthropic')
    setLastUsedProvider('anthropic')
    vi.mocked(mockAnthropicGenerate).mockResolvedValueOnce({
      ok: true,
      stream: new ReadableStream<string>(),
    })

    const result = await generateWithSelectedProvider({ operation: 'summarize', text: 'test' })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.provider).toBe('anthropic')
      expect(mockAnthropicGenerate).toHaveBeenCalled()
    }
  })

  it('generate が成功すると provider と result を返す', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-key')
    const { generateWithSelectedProvider } = await import('@/lib/ai/index')
    const { generate: mockGeminiGenerate } = await import('@/lib/ai/providers/gemini')
    const mockStream = new ReadableStream<string>()
    vi.mocked(mockGeminiGenerate).mockResolvedValueOnce({ ok: true, stream: mockStream })

    const result = await generateWithSelectedProvider({ operation: 'ask', text: 'text', question: '質問' })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.result.ok).toBe(true)
      if (result.result.ok) {
        expect(result.result.stream).toBe(mockStream)
      }
    }
  })

  it('generate が失敗すると error 情報を含む result を返す', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-key')
    const { generateWithSelectedProvider } = await import('@/lib/ai/index')
    const { generate: mockGeminiGenerate } = await import('@/lib/ai/providers/gemini')
    vi.mocked(mockGeminiGenerate).mockResolvedValueOnce({
      ok: false,
      error: { kind: 'key_invalid', message: '鍵が無効' },
    })

    const result = await generateWithSelectedProvider({ operation: 'summarize', text: 'test' })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.result.ok).toBe(false)
      if (!result.result.ok) {
        expect(result.result.error.kind).toBe('key_invalid')
      }
    }
  })

  it('選択後に lastUsedProvider が更新される', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-key')
    const { generateWithSelectedProvider, getLastUsedProvider } = await import('@/lib/ai/index')
    const { generate: mockGeminiGenerate } = await import('@/lib/ai/providers/gemini')
    vi.mocked(mockGeminiGenerate).mockResolvedValueOnce({
      ok: true,
      stream: new ReadableStream<string>(),
    })

    await generateWithSelectedProvider({ operation: 'summarize', text: 'test' })

    expect(getLastUsedProvider()).toBe('gemini')
  })
})
