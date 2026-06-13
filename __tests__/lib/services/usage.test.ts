import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))

const { getStorageUsage } = await import('@/lib/services/usage')

const USER_ID = 'a0000001-0000-4000-8000-000000000001'
const FREE_LIMIT_BYTES = 200 * 1024 * 1024
const PAID_LIMIT_BYTES = 5 * 1024 * 1024 * 1024

beforeEach(() => {
  mockClient = createMockSupabaseClient({ user: { id: USER_ID } })
})

describe('getStorageUsage', () => {
  it('正常系(無料): 使用量0・上限200MBを返す', async () => {
    // getUserPlan: free
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    // list(userId): フォルダなし
    mockClient._storage._bucket.list.mockResolvedValueOnce({ data: [], error: null })

    const result = await getStorageUsage(USER_ID)

    expect(result.usedBytes).toBe(0)
    expect(result.limitBytes).toBe(FREE_LIMIT_BYTES)
  })

  it('正常系(有料): 使用量0・上限5GBを返す', async () => {
    // getUserPlan: paid
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'paid' }, error: null })
    // list(userId): フォルダなし
    mockClient._storage._bucket.list.mockResolvedValueOnce({ data: [], error: null })

    const result = await getStorageUsage(USER_ID)

    expect(result.usedBytes).toBe(0)
    expect(result.limitBytes).toBe(PAID_LIMIT_BYTES)
  })

  it('正常系: 複数フォルダのファイルサイズを合計する', async () => {
    // getUserPlan: free
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })

    // list(userId): 2つの page_id フォルダ
    mockClient._storage._bucket.list
      .mockResolvedValueOnce({
        data: [{ name: 'page-id-1' }, { name: 'page-id-2' }],
        error: null,
      })
      // list(userId/page-id-1): 2ファイル
      .mockResolvedValueOnce({
        data: [
          { name: 'img1.webp', metadata: { size: 1024 * 1024 } }, // 1MB
          { name: 'img2.webp', metadata: { size: 2 * 1024 * 1024 } }, // 2MB
        ],
        error: null,
      })
      // list(userId/page-id-2): 1ファイル
      .mockResolvedValueOnce({
        data: [{ name: 'img3.webp', metadata: { size: 3 * 1024 * 1024 } }], // 3MB
        error: null,
      })

    const result = await getStorageUsage(USER_ID)

    expect(result.usedBytes).toBe(6 * 1024 * 1024) // 合計 6MB
    expect(result.limitBytes).toBe(FREE_LIMIT_BYTES)
  })

  it('metadata が null のファイルはサイズ0として扱う', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })

    mockClient._storage._bucket.list
      .mockResolvedValueOnce({
        data: [{ name: 'page-id-1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { name: 'img.webp', metadata: null }, // metadata なし
        ],
        error: null,
      })

    const result = await getStorageUsage(USER_ID)

    expect(result.usedBytes).toBe(0)
  })

  it('フォルダの list が null を返した場合はスキップして合計を返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })

    mockClient._storage._bucket.list
      .mockResolvedValueOnce({
        data: [{ name: 'page-id-1' }, { name: 'page-id-2' }],
        error: null,
      })
      // 1つ目のフォルダは null（エラー等）
      .mockResolvedValueOnce({ data: null, error: { message: 'list error' } })
      // 2つ目のフォルダは正常
      .mockResolvedValueOnce({
        data: [{ name: 'img.webp', metadata: { size: 512 * 1024 } }], // 512KB
        error: null,
      })

    const result = await getStorageUsage(USER_ID)

    expect(result.usedBytes).toBe(512 * 1024)
  })

  it('profiles が見つからない場合は free プランとして扱う', async () => {
    // profiles: null（未作成）
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockClient._storage._bucket.list.mockResolvedValueOnce({ data: [], error: null })

    const result = await getStorageUsage(USER_ID)

    expect(result.limitBytes).toBe(FREE_LIMIT_BYTES)
  })
})
