/**
 * providers/anthropic.ts のユニットテスト。
 * fetch を vi.stubGlobal でモック。実 API 呼び出しは禁止。
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

const { generate } = await import('@/lib/ai/providers/anthropic')

function makeAnthropicSseChunk(text: string): string {
  const payload = {
    type: 'content_block_delta',
    delta: { type: 'text_delta', text },
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

describe('anthropic.generate - 正常系', () => {
  it('成功すると ok: true と stream を返す', async () => {
    const sseChunk = makeAnthropicSseChunk('こんにちは')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const result = await generate(BASE_PARAMS, 'sk-ant-test-key')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stream).toBeInstanceOf(ReadableStream)
    }
  })

  it('ストリームからテキストを読み取れる', async () => {
    const sseChunk = makeAnthropicSseChunk('Anthropic 応答テキスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    )

    const result = await generate(BASE_PARAMS, 'sk-ant-test-key')
    expect(result.ok).toBe(true)
    if (result.ok) {
      const reader = result.stream.getReader()
      const { value } = await reader.read()
      expect(value).toBe('Anthropic 応答テキスト')
    }
  })
})

describe('anthropic.generate - 必須ヘッダ検証', () => {
  it('anthropic-dangerous-direct-browser-access ヘッダを送信する', async () => {
    const sseChunk = makeAnthropicSseChunk('テスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), { status: 200 })
    )

    await generate(BASE_PARAMS, 'sk-ant-mykey')

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = fetchCall[1]?.headers as Record<string, string>
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
  })

  it('x-api-key ヘッダに鍵を含める', async () => {
    const sseChunk = makeAnthropicSseChunk('テスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), { status: 200 })
    )

    await generate(BASE_PARAMS, 'sk-ant-secret-key')

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = fetchCall[1]?.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-secret-key')
  })

  it('Anthropic 公式ドメインにリクエストする', async () => {
    const sseChunk = makeAnthropicSseChunk('テスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), { status: 200 })
    )

    await generate(BASE_PARAMS, 'sk-ant-key')

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(fetchCall[0]).toContain('api.anthropic.com')
  })

  it('anthropic-version ヘッダを送信する', async () => {
    const sseChunk = makeAnthropicSseChunk('テスト')
    mockFetch.mockResolvedValueOnce(
      new Response(makeSseBody([sseChunk]), { status: 200 })
    )

    await generate(BASE_PARAMS, 'sk-ant-key')

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = fetchCall[1]?.headers as Record<string, string>
    expect(headers['anthropic-version']).toBeTruthy()
  })
})

describe('anthropic.generate - エラーハンドリング', () => {
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

    const result = await generate(BASE_PARAMS, 'sk-ant-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('rate_limited')
    }
  })

  it('500 は unknown エラーを返す', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }))

    const result = await generate(BASE_PARAMS, 'sk-ant-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('unknown')
    }
  })

  it('ネットワークエラーは network エラーを返す', async () => {
    mockFetch.mockRejectedValueOnce(new Error('接続失敗'))

    const result = await generate(BASE_PARAMS, 'sk-ant-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('network')
    }
  })

  it('AbortError は network エラーを返す', async () => {
    const abortError = new DOMException('中断', 'AbortError')
    mockFetch.mockRejectedValueOnce(abortError)

    const result = await generate(BASE_PARAMS, 'sk-ant-key')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('network')
    }
  })
})
