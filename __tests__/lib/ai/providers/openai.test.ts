/**
 * providers/openai.ts のユニットテスト。
 * fetch を vi.stubGlobal でモック。実 API 呼び出しは禁止。
 * OpenAI は /api/ai/proxy 経由であることを確認する。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GenerateParams } from '@/lib/ai/types'

const mockFetch = vi.fn()
const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  vi.clearAllMocks()
})

afterEach(() => {
  vi.stubGlobal('fetch', originalFetch)
})

const { generate } = await import('@/lib/ai/providers/openai')

function makeOpenAiSseChunk(text: string): string {
  const payload = {
    choices: [{ delta: { content: text } }],
  }
  return `data: ${JSON.stringify(payload)}\n\n`
}

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

const BASE_PARAMS: GenerateParams = {
  operation: 'summarize',
  text: 'テストテキスト',
}

describe('openai.generate - proxy 経由の確認', () => {
  it('/api/ai/proxy に POST する（OpenAI 公式 API に直接送らない）', async () => {
    const sseChunk = makeOpenAiSseChunk('テスト回答')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    await generate(BASE_PARAMS, 'sk-test-key')

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    // proxy エンドポイントに送る
    expect(fetchCall[0]).toBe('/api/ai/proxy')
    // OpenAI 公式 API には直接送らない
    expect(fetchCall[0]).not.toContain('api.openai.com')
  })

  it('Authorization ヘッダに Bearer キーを含める', async () => {
    const sseChunk = makeOpenAiSseChunk('テスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), { status: 200 })
    )

    await generate(BASE_PARAMS, 'sk-my-secret-key')

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = fetchCall[1]?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer sk-my-secret-key')
  })

  it('リクエストボディに path フィールドが含まれる', async () => {
    const sseChunk = makeOpenAiSseChunk('テスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), { status: 200 })
    )

    await generate(BASE_PARAMS, 'sk-key')

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(fetchCall[1]?.body as string) as { path: string }
    expect(body.path).toBe('/v1/chat/completions')
  })

  it('リクエストボディに messages フィールドが含まれる', async () => {
    const sseChunk = makeOpenAiSseChunk('テスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), { status: 200 })
    )

    await generate(BASE_PARAMS, 'sk-key')

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(fetchCall[1]?.body as string) as { messages: unknown[] }
    expect(Array.isArray(body.messages)).toBe(true)
    expect(body.messages.length).toBeGreaterThan(0)
  })
})

describe('openai.generate - 正常系', () => {
  it('成功すると ok: true と stream を返す', async () => {
    const sseChunk = makeOpenAiSseChunk('OpenAI 応答')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const result = await generate(BASE_PARAMS, 'sk-test-key')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stream).toBeInstanceOf(ReadableStream)
    }
  })

  it('ストリームからテキストを読み取れる', async () => {
    const sseChunk = makeOpenAiSseChunk('OpenAI テキスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const result = await generate(BASE_PARAMS, 'sk-test-key')
    expect(result.ok).toBe(true)
    if (result.ok) {
      const reader = result.stream.getReader()
      const { value } = await reader.read()
      expect(value).toBe('OpenAI テキスト')
    }
  })
})

describe('openai.generate - エラーハンドリング', () => {
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

    const result = await generate(BASE_PARAMS, 'sk-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('rate_limited')
    }
  })

  it('500 は unknown エラーを返す', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }))

    const result = await generate(BASE_PARAMS, 'sk-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('unknown')
    }
  })

  it('ネットワークエラーは network エラーを返す', async () => {
    mockFetch.mockRejectedValueOnce(new Error('接続失敗'))

    const result = await generate(BASE_PARAMS, 'sk-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('network')
    }
  })
})

describe('openai.generate - 鍵非漏洩の検証', () => {
  it('proxy 以外（api.openai.com）へ直接送らない', async () => {
    const sseChunk = makeOpenAiSseChunk('テスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), { status: 200 })
    )

    await generate(BASE_PARAMS, 'sk-sensitive-key')

    // 呼び出し先は /api/ai/proxy のみ
    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(fetchCall[0]).toBe('/api/ai/proxy')
    expect(fetchCall[0]).not.toContain('api.openai.com')
    expect(fetchCall[0]).not.toContain('sk-sensitive-key')
  })

  it('エラーレスポンスに鍵が含まれない', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Error', { status: 500 }))

    const result = await generate(BASE_PARAMS, 'sk-error-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).not.toContain('sk-error-key')
    }
  })
})
