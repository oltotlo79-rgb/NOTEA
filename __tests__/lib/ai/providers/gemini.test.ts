/**
 * providers/gemini.ts のユニットテスト。
 * fetch を vi.stubGlobal でモック。実 API 呼び出しは禁止。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GenerateParams } from '@/lib/ai/types'
import { AI_MAX_INPUT_CHARS } from '@/lib/constants/ai'

const mockFetch = vi.fn()
const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  vi.clearAllMocks()
})

afterEach(() => {
  vi.stubGlobal('fetch', originalFetch)
})

// 動的インポートでモジュールキャッシュを回避
const { generate } = await import('@/lib/ai/providers/gemini')

/** SSE ストリームのレスポンスボディを作成するヘルパー */
function makeSseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function makeGeminiSseChunk(text: string): string {
  const payload = {
    candidates: [{ content: { parts: [{ text }] } }],
  }
  return `data: ${JSON.stringify(payload)}\n\n`
}

const BASE_PARAMS: GenerateParams = {
  operation: 'summarize',
  text: 'テストテキスト',
}

describe('gemini.generate - 正常系', () => {
  it('成功すると ok: true と stream を返す', async () => {
    const sseChunk = makeGeminiSseChunk('こんにちは')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const result = await generate(BASE_PARAMS, 'AIzaSy-test-key')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stream).toBeInstanceOf(ReadableStream)
    }
  })

  it('ストリームからテキストを読み取れる', async () => {
    const sseChunk = makeGeminiSseChunk('生成テキスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const result = await generate(BASE_PARAMS, 'AIzaSy-test-key')
    expect(result.ok).toBe(true)
    if (result.ok) {
      const reader = result.stream.getReader()
      const { value } = await reader.read()
      expect(value).toBe('生成テキスト')
    }
  })

  it('continue 操作でも正常に動作する', async () => {
    const sseChunk = makeGeminiSseChunk('続きのテキスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const params: GenerateParams = { operation: 'continue', text: '本文の続き' }
    const result = await generate(params, 'AIzaSy-test-key')
    expect(result.ok).toBe(true)
  })

  it('translate 操作でも正常に動作する', async () => {
    const sseChunk = makeGeminiSseChunk('Hello')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const params: GenerateParams = {
      operation: 'translate',
      text: 'こんにちは',
      sourceLang: '日本語',
      targetLang: '英語',
    }
    const result = await generate(params, 'AIzaSy-test-key')
    expect(result.ok).toBe(true)
  })

  it('ask 操作でも正常に動作する', async () => {
    const sseChunk = makeGeminiSseChunk('回答です')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const params: GenerateParams = {
      operation: 'ask',
      text: 'ページ本文',
      question: '質問',
    }
    const result = await generate(params, 'AIzaSy-test-key')
    expect(result.ok).toBe(true)
  })
})

describe('gemini.generate - エラーハンドリング', () => {
  it('401 は key_invalid エラーを返す', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))

    const result = await generate(BASE_PARAMS, 'invalid-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('key_invalid')
    }
  })

  it('403 は key_invalid エラーを返す', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))

    const result = await generate(BASE_PARAMS, 'invalid-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('key_invalid')
    }
  })

  it('429 は rate_limited エラーを返す', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))

    const result = await generate(BASE_PARAMS, 'AIzaSy-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('rate_limited')
    }
  })

  it('500 は unknown エラーを返す', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }))

    const result = await generate(BASE_PARAMS, 'AIzaSy-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('unknown')
    }
  })

  it('ネットワークエラー（fetch 例外）は network エラーを返す', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ネットワーク接続エラー'))

    const result = await generate(BASE_PARAMS, 'AIzaSy-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('network')
    }
  })

  it('AbortError は network エラーを返す', async () => {
    const abortError = new DOMException('中断されました', 'AbortError')
    mockFetch.mockRejectedValueOnce(abortError)

    const result = await generate(BASE_PARAMS, 'AIzaSy-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('network')
    }
  })

  it('body が null の場合は unknown エラーを返す', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, { status: 200 })
    )

    const result = await generate(BASE_PARAMS, 'AIzaSy-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('unknown')
    }
  })
})

describe('gemini.generate - 鍵の取り扱い', () => {
  it('fetch の URL に鍵が含まれる（Gemini は URL パラメータで認証）', async () => {
    const sseChunk = makeGeminiSseChunk('テスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), { status: 200 })
    )

    await generate(BASE_PARAMS, 'AIzaSy-mykey123')

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    // Gemini は URL クエリパラメータに鍵を含める仕様
    expect(fetchCall[0]).toContain('AIzaSy-mykey123')
    // Gemini のオリジンに送っている
    expect(fetchCall[0]).toContain('generativelanguage.googleapis.com')
  })

  it('入力テキストが AI_MAX_INPUT_CHARS を超える場合にトリミングされる', async () => {
    const longText = 'あ'.repeat(AI_MAX_INPUT_CHARS + 100)
    const sseChunk = makeGeminiSseChunk('要約')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), { status: 200 })
    )

    await generate({ operation: 'summarize', text: longText }, 'AIzaSy-key')

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(fetchCall[1]?.body as string) as { contents: Array<{ parts: Array<{ text: string }> }> }
    const sentText = body.contents[0]?.parts[0]?.text ?? ''
    // プロンプト全体で AI_MAX_INPUT_CHARS 以下のテキストが使われている
    expect(sentText.length).toBeLessThanOrEqual(AI_MAX_INPUT_CHARS + 500)
  })
})
