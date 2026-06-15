import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'

// 環境変数を事前設定
process.env.CRON_SECRET = CRON_SECRET
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test'

type StorageFile = { name: string; metadata?: Record<string, unknown> | null }
type StorageListResult = { data: StorageFile[] | null; error: { message: string } | null }
type StorageRemoveResult = { data: unknown; error: { message: string } | null }

const mockStorageBucket = {
  list: vi.fn<() => Promise<StorageListResult>>(async () => ({ data: [], error: null })),
  remove: vi.fn<() => Promise<StorageRemoveResult>>(async () => ({ data: null, error: null })),
}

const mockBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve),
}

const mockAdminClient = {
  from: vi.fn(() => mockBuilder),
  storage: {
    from: vi.fn(() => mockStorageBucket),
  },
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockAdminClient,
}))

const { GET } = await import('@/app/api/cron/cleanup-trash/route')

function makeRequest(withValidAuth = true): NextRequest {
  const headers: Record<string, string> = {}
  if (withValidAuth) {
    headers['Authorization'] = `Bearer ${CRON_SECRET}`
  }
  return new NextRequest('http://localhost/api/cron/cleanup-trash', {
    method: 'GET',
    headers,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockBuilder.select.mockReturnThis()
  mockBuilder.eq.mockReturnThis()
  mockBuilder.lt.mockReturnThis()
  mockBuilder.delete.mockReturnThis()
  mockBuilder.in.mockReturnThis()
  mockStorageBucket.list.mockResolvedValue({ data: [], error: null })
  mockStorageBucket.remove.mockResolvedValue({ data: null, error: null })
})

// =====================
// 認証チェック
// =====================
describe('GET /api/cron/cleanup-trash - 認証', () => {
  it('Authorization ヘッダなしは 401 を返す', async () => {
    const req = makeRequest(false)
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Unauthorized')
  })

  it('不正な Bearer トークンは 401 を返す', async () => {
    const req = new NextRequest('http://localhost/api/cron/cleanup-trash', {
      headers: { Authorization: 'Bearer wrong-secret' },
    })
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('Cache-Control: no-store が 401 時にも付く', async () => {
    const req = makeRequest(false)
    const res = await GET(req)

    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})

// =====================
// 正常系
// =====================
describe('GET /api/cron/cleanup-trash - 正常系', () => {
  it('対象ページが 0 件のとき deleted: 0 を返す', async () => {
    // select チェーンの最終 then で空配列を返す
    mockBuilder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve)

    const req = makeRequest()
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json() as { deleted: number }
    expect(body.deleted).toBe(0)
  })

  it('対象ページが存在するとき Storage 削除と DB 削除が呼ばれる', async () => {
    const pages = [
      { id: 'page-id-1', user_id: 'user-id-1' },
      { id: 'page-id-2', user_id: 'user-id-1' },
    ]

    // pages select の then（2回呼ばれるので最初だけ override）
    let thenCallCount = 0
    mockBuilder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
      thenCallCount++
      if (thenCallCount === 1) {
        return Promise.resolve({ data: pages, error: null }).then(resolve)
      }
      // delete の then
      return Promise.resolve({ data: null, error: null }).then(resolve)
    }

    // Storage にファイルなし（シンプルに）
    mockStorageBucket.list.mockResolvedValue({ data: [], error: null })

    const req = makeRequest()
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json() as { deleted: number }
    expect(body.deleted).toBe(2)
  })

  it('Storage にファイルがある場合は remove が呼ばれる', async () => {
    const pages = [{ id: 'page-id-1', user_id: 'user-id-1' }]

    let thenCallCount = 0
    mockBuilder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) => {
      thenCallCount++
      if (thenCallCount === 1) {
        return Promise.resolve({ data: pages, error: null }).then(resolve)
      }
      return Promise.resolve({ data: null, error: null }).then(resolve)
    }

    mockStorageBucket.list.mockResolvedValueOnce({
      data: [{ name: 'image.webp' }],
      error: null,
    })

    const req = makeRequest()
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockStorageBucket.remove).toHaveBeenCalled()
  })
})

// =====================
// DB エラー系
// =====================
describe('GET /api/cron/cleanup-trash - DB エラー', () => {
  it('ページ取得で DB エラーが起きた場合は 500 を返す', async () => {
    mockBuilder.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: null, error: { message: 'db error' } }).then(resolve)

    const req = makeRequest()
    const res = await GET(req)

    expect(res.status).toBe(500)
  })
})
