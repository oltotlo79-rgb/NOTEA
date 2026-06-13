import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

// react の cache() は vitest 環境では単純にラップするだけ（メモ化はリクエストスコープ外で無効）
// 各テストで動的 import してキャッシュを回避する
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))

let mockClient: MockSupabaseClient

beforeEach(() => {
  mockClient = createMockSupabaseClient()
  vi.resetModules()
})

// =====================
// getPage
// =====================
describe('getPage', () => {
  it('認証済みかつ行が存在する場合はページデータを返す', async () => {
    const pageData = {
      id: 'a0000001-0000-4000-8000-000000000001',
      parent_id: null,
      title: 'テストページ',
      icon: null,
      content: null,
      content_text: null,
      updated_at: '2026-01-01T00:00:00Z',
      is_trashed: false,
    }
    mockClient._maybeSingle.mockResolvedValueOnce({ data: pageData, error: null })

    const { getPage } = await import('@/lib/queries/pages')
    const result = await getPage('a0000001-0000-4000-8000-000000000001')

    expect(result).toEqual(pageData)
    expect(mockClient.auth.getUser).toHaveBeenCalledOnce()
    expect(mockClient.from).toHaveBeenCalledWith('pages')
  })

  it('maybeSingle が null を返す場合は null を返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const { getPage } = await import('@/lib/queries/pages')
    const result = await getPage('a0000001-0000-4000-8000-000000000001')

    expect(result).toBeNull()
  })

  it('未認証（user=null）の場合は null を返し、DB クエリを呼ばない', async () => {
    mockClient = createMockSupabaseClient({ user: null })

    const { getPage } = await import('@/lib/queries/pages')
    const result = await getPage('a0000001-0000-4000-8000-000000000001')

    expect(result).toBeNull()
    // DB は呼ばれないこと（認証チェックで早期リターン）
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it('RLS 二重チェック: user_id で eq が呼ばれる', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const { getPage } = await import('@/lib/queries/pages')
    await getPage('a0000001-0000-4000-8000-000000000001')

    const eqFn = mockClient._builder.eq as ReturnType<typeof vi.fn>
    const userIdCall = eqFn.mock.calls.find(
      (c) => c[0] === 'user_id' && c[1] === 'user-1'
    )
    expect(userIdCall).toBeDefined()
  })

  it('is_trashed=false フィルタが適用される', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const { getPage } = await import('@/lib/queries/pages')
    await getPage('a0000001-0000-4000-8000-000000000001')

    const eqFn = mockClient._builder.eq as ReturnType<typeof vi.fn>
    const isTrashedCall = eqFn.mock.calls.find(
      (c) => c[0] === 'is_trashed' && c[1] === false
    )
    expect(isTrashedCall).toBeDefined()
  })
})

// =====================
// getMostRecentPageId
// =====================
describe('getMostRecentPageId', () => {
  it('行が存在する場合は最新ページの id を返す', async () => {
    const pageData = { id: 'b0000001-0000-4000-8000-000000000001' }
    mockClient._maybeSingle.mockResolvedValueOnce({ data: pageData, error: null })

    const { getMostRecentPageId } = await import('@/lib/queries/pages')
    const result = await getMostRecentPageId()

    expect(result).toBe('b0000001-0000-4000-8000-000000000001')
    expect(mockClient.auth.getUser).toHaveBeenCalledOnce()
  })

  it('行が存在しない場合（maybeSingle が null）は null を返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const { getMostRecentPageId } = await import('@/lib/queries/pages')
    const result = await getMostRecentPageId()

    expect(result).toBeNull()
  })

  it('未認証（user=null）の場合は null を返し、DB クエリを呼ばない', async () => {
    mockClient = createMockSupabaseClient({ user: null })

    const { getMostRecentPageId } = await import('@/lib/queries/pages')
    const result = await getMostRecentPageId()

    expect(result).toBeNull()
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it('updated_at 降順で order が呼ばれる', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const { getMostRecentPageId } = await import('@/lib/queries/pages')
    await getMostRecentPageId()

    const orderFn = mockClient._builder.order as ReturnType<typeof vi.fn>
    expect(orderFn).toHaveBeenCalledWith('updated_at', { ascending: false })
  })

  it('limit(1) が呼ばれる', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const { getMostRecentPageId } = await import('@/lib/queries/pages')
    await getMostRecentPageId()

    const limitFn = mockClient._builder.limit as ReturnType<typeof vi.fn>
    expect(limitFn).toHaveBeenCalledWith(1)
  })

  it('is_trashed=false フィルタが適用される', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const { getMostRecentPageId } = await import('@/lib/queries/pages')
    await getMostRecentPageId()

    const eqFn = mockClient._builder.eq as ReturnType<typeof vi.fn>
    const isTrashedCall = eqFn.mock.calls.find(
      (c) => c[0] === 'is_trashed' && c[1] === false
    )
    expect(isTrashedCall).toBeDefined()
  })
})
