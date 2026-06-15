import { describe, expect, it, vi } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test'

const mockFromBuilder = {
  select: vi.fn().mockReturnThis(),
  // head: true の select は thenable として使われる
  then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve),
}

const mockAdminClient = {
  from: vi.fn(() => mockFromBuilder),
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockAdminClient,
}))

const { GET } = await import('@/app/api/health/route')

describe('GET /api/health', () => {
  it('DB が正常なとき status: ok と 200 を返す', async () => {
    mockFromBuilder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve)

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('ok')
  })

  it('DB がエラーを返したとき status: error と 503 を返す', async () => {
    mockFromBuilder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: null, error: { message: 'connection refused' } }).then(resolve)

    const res = await GET()

    expect(res.status).toBe(503)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('error')
  })

  it('createAdminClient が throw した場合も 503 を返す', async () => {
    // モジュールレベルで throw をシミュレートするため一時的に上書き
    mockAdminClient.from.mockImplementationOnce(() => {
      throw new Error('connection failed')
    })

    const res = await GET()

    expect(res.status).toBe(503)
  })

  it('Cache-Control: no-store が必ず付く', async () => {
    mockFromBuilder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve)

    const res = await GET()

    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('秘密情報（接続文字列等）をレスポンスに含めない', async () => {
    mockFromBuilder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: null, error: { message: 'SUPABASE_SERVICE_ROLE_KEY exposed' } }).then(resolve)

    const res = await GET()
    const body = await res.json() as Record<string, unknown>

    // レスポンスは status フィールドのみ
    expect(Object.keys(body)).toEqual(['status'])
    // DB エラーメッセージを直接露出しない
    expect(JSON.stringify(body)).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('認証なしで 200 / 503 を返す（認証不要のエンドポイント）', async () => {
    mockFromBuilder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve)

    // Authorization ヘッダなしで呼べること
    const res = await GET()
    expect(res.status).toBe(200)
  })
})
