import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../../../utils/test-utils'
import { NextRequest } from 'next/server'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))

// factory 内で vi.fn() を直接返す（hoisting により factory 外の変数は undefined になるため）
vi.mock('@/lib/services/usage', () => ({
  consumeAiUsage: vi.fn(),
  getAiUsageToday: vi.fn(),
  getStorageUsage: vi.fn(),
}))

const mockFetch = vi.fn()
const originalFetch = globalThis.fetch

const USER_ID = 'a0000001-0000-4000-8000-000000000001'

function makeRequest(body: Record<string, unknown>, apiKey = 'sk-test-key') {
  return new NextRequest('http://localhost/api/ai/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
}

// 動的インポートでモジュールキャッシュを回避する
const { POST } = await import('@/app/api/ai/proxy/route')
const { consumeAiUsage: mockConsumeAiUsage } = await import('@/lib/services/usage')

beforeEach(() => {
  mockClient = createMockSupabaseClient({ user: { id: USER_ID } })
  vi.clearAllMocks()
  globalThis.fetch = mockFetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// =====================
// 認証チェック
// =====================
describe('POST /api/ai/proxy - 認証', () => {
  it('未認証は 401 を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })

    const req = makeRequest({ path: '/v1/chat/completions' })
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('ログイン')
  })

  it('Cache-Control: no-store が必ず付く（未認証でも）', async () => {
    mockClient = createMockSupabaseClient({ user: null })

    const req = makeRequest({ path: '/v1/chat/completions' })
    const res = await POST(req)

    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})

// =====================
// allowlist 検証（SSRF 防止）
// =====================
describe('POST /api/ai/proxy - allowlist', () => {
  it('/ で始まらない path は 403', async () => {
    const req = new NextRequest('http://localhost/api/ai/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test',
      },
      body: JSON.stringify({ path: 'relative/path' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('https:// を path に指定しても 403（オリジン違いの SSRF 防止）', async () => {
    const req = new NextRequest('http://localhost/api/ai/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test',
      },
      body: JSON.stringify({ path: 'https://evil.com/steal-key' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('path フィールドが無いリクエストは 400', async () => {
    const req = makeRequest({ message: 'no path field' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('path フィールドが文字列以外は 400', async () => {
    const req = makeRequest({ path: 123 })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// =====================
// 回数消費チェック
// =====================
describe('POST /api/ai/proxy - 回数消費', () => {
  it('プラン違反は 403 を返す', async () => {
    vi.mocked(mockConsumeAiUsage).mockResolvedValueOnce({
      code: 'PROVIDER_NOT_ALLOWED',
      message: 'このプロバイダは有料プランでのみ利用できます',
    })

    const req = makeRequest({ path: '/v1/chat/completions' })
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('有料プラン')
  })

  it('上限超過は 429 を返す', async () => {
    vi.mocked(mockConsumeAiUsage).mockResolvedValueOnce({
      code: 'LIMIT_EXCEEDED',
      message: 'AI の利用回数が本日の上限（5回）に達しました',
      limit: 5,
    })

    const req = makeRequest({ path: '/v1/chat/completions' })
    const res = await POST(req)

    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('5')
  })

  it('消費は転送前に行われる（fetch より先に consumeAiUsage が呼ばれる）', async () => {
    // fetch が呼ばれた時点で consumeAiUsage が既に呼ばれていることを検証する
    vi.mocked(mockConsumeAiUsage).mockResolvedValueOnce({ remaining: 4 })
    let consumeCalledBeforeFetch = false
    mockFetch.mockImplementation(async () => {
      consumeCalledBeforeFetch = vi.mocked(mockConsumeAiUsage).mock.calls.length > 0
      return new Response(JSON.stringify({ choices: [] }), { status: 200 })
    })

    const req = makeRequest({ path: '/v1/chat/completions' })
    await POST(req)

    expect(consumeCalledBeforeFetch).toBe(true)
  })
})

// =====================
// 正常転送
// =====================
describe('POST /api/ai/proxy - 正常転送', () => {
  it('OpenAI のレスポンスをそのまま返す', async () => {
    vi.mocked(mockConsumeAiUsage).mockResolvedValueOnce({ remaining: 4 })
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const req = makeRequest({ path: '/v1/chat/completions' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('fetch に渡す Authorization ヘッダがリクエストのものと一致する', async () => {
    vi.mocked(mockConsumeAiUsage).mockResolvedValueOnce({ remaining: 4 })
    mockFetch.mockResolvedValueOnce(
      new Response('{}', { status: 200 })
    )

    const req = makeRequest({ path: '/v1/chat/completions' }, 'sk-actual-key')
    await POST(req)

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    const forwardedHeaders = fetchCall[1]?.headers as Record<string, string>
    expect(forwardedHeaders['Authorization']).toBe('Bearer sk-actual-key')
  })

  it('転送先 URL が OpenAI ドメインになっている', async () => {
    vi.mocked(mockConsumeAiUsage).mockResolvedValueOnce({ remaining: 4 })
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const req = makeRequest({ path: '/v1/chat/completions' })
    await POST(req)

    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(fetchCall[0]).toBe('https://api.openai.com/v1/chat/completions')
  })
})

// =====================
// 鍵非漏洩の保証
// =====================
describe('POST /api/ai/proxy - 鍵非漏洩', () => {
  it('エラーレスポンスのボディに Authorization ヘッダの値が含まれない', async () => {
    vi.mocked(mockConsumeAiUsage).mockResolvedValueOnce({ remaining: 4 })
    // fetch がネットワークエラーを投げる
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    const req = makeRequest({ path: '/v1/chat/completions' }, 'sk-secret-key-12345')
    const res = await POST(req)

    const body = await res.text()
    expect(body).not.toContain('sk-secret-key-12345')
    expect(res.status).toBe(502)
  })

  it('上限超過エラーのレスポンスに鍵が含まれない', async () => {
    vi.mocked(mockConsumeAiUsage).mockResolvedValueOnce({
      code: 'LIMIT_EXCEEDED',
      message: 'AI の利用回数が本日の上限（5回）に達しました',
      limit: 5,
    })

    const req = makeRequest({ path: '/v1/chat/completions' }, 'sk-secret-key-12345')
    const res = await POST(req)

    const body = await res.text()
    expect(body).not.toContain('sk-secret-key-12345')
  })

  it('consumeAiUsage の呼び出し引数に鍵が含まれない', async () => {
    vi.mocked(mockConsumeAiUsage).mockResolvedValueOnce({ remaining: 4 })
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const req = makeRequest({ path: '/v1/chat/completions' }, 'sk-secret-key-12345')
    await POST(req)

    // consumeAiUsage は userId と provider のみで呼ばれる
    expect(mockConsumeAiUsage).toHaveBeenCalledWith(USER_ID, 'openai')
    const args = vi.mocked(mockConsumeAiUsage).mock.calls[0] as unknown[]
    const argsStr = JSON.stringify(args)
    expect(argsStr).not.toContain('sk-secret-key-12345')
  })

  it('認証なしエラーのレスポンスに鍵が含まれない', async () => {
    mockClient = createMockSupabaseClient({ user: null })

    const req = makeRequest({ path: '/v1/chat/completions' }, 'sk-secret-key-12345')
    const res = await POST(req)

    const body = await res.text()
    expect(body).not.toContain('sk-secret-key-12345')
    expect(res.status).toBe(401)
  })
})
