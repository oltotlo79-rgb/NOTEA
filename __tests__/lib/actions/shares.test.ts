import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))

const { createShare, revokeShare, listShares } = await import('@/lib/actions/shares')

const PAGE_ID = 'a0000001-0000-4000-8000-000000000001'

function setChainResult(result: { data: unknown; error: { message: string } | null }) {
  mockClient._defaultResult.current = result as { data: unknown; error: { message: string } | null }
}

beforeEach(() => {
  mockClient = createMockSupabaseClient()
})

describe('createShare', () => {
  it('未認証はエラー', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await createShare({ pageId: PAGE_ID, permission: 'view' })
    expect(result).toMatchObject({ success: false })
  })

  it('不正な permission は Zod で拒否', async () => {
    // @ts-expect-error 不正入力のテスト
    const result = await createShare({ pageId: PAGE_ID, permission: 'admin' })
    expect(result).toMatchObject({ success: false })
    // ページ所有確認に到達しない
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it('他人/存在しないページはエラー（所有確認で弾く）', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await createShare({ pageId: PAGE_ID, permission: 'view' })
    expect(result).toMatchObject({ success: false })
  })

  it('既存リンクがあればトークンを再生成せず返す', async () => {
    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { id: PAGE_ID }, error: null }) // 所有確認
      .mockResolvedValueOnce({ data: { token: 'existing-token', permission: 'view' }, error: null }) // 既存

    const result = await createShare({ pageId: PAGE_ID, permission: 'view' })
    expect(result).toMatchObject({ success: true, data: { token: 'existing-token', permission: 'view' } })
  })

  it('既存リンクが無ければトークンを発行して insert する', async () => {
    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { id: PAGE_ID }, error: null }) // 所有確認
      .mockResolvedValueOnce({ data: null, error: null }) // 既存なし
    setChainResult({ data: null, error: null }) // insert 成功

    const result = await createShare({ pageId: PAGE_ID, permission: 'edit' })
    expect(result).toMatchObject({ success: true })
    if (result.success && result.data) {
      expect(result.data.permission).toBe('edit')
      expect(result.data.token).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(result.data.token.length).toBeGreaterThanOrEqual(16)
    }
    const insertFn = mockClient._builder.insert as ReturnType<typeof vi.fn>
    expect(insertFn).toHaveBeenCalled()
  })

  it('insert 失敗時はエラー', async () => {
    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { id: PAGE_ID }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    setChainResult({ data: null, error: { message: 'insert failed' } })

    const result = await createShare({ pageId: PAGE_ID, permission: 'view' })
    expect(result).toMatchObject({ success: false })
  })
})

describe('revokeShare', () => {
  it('未認証はエラー', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await revokeShare({ pageId: PAGE_ID, permission: 'view' })
    expect(result).toMatchObject({ success: false })
  })

  it('正常に失効（delete）する', async () => {
    setChainResult({ data: null, error: null })
    const result = await revokeShare({ pageId: PAGE_ID, permission: 'view' })
    expect(result).toMatchObject({ success: true })
    const deleteFn = mockClient._builder.delete as ReturnType<typeof vi.fn>
    expect(deleteFn).toHaveBeenCalled()
    // user_id 一致での削除（多層防御）
    const eqFn = mockClient._builder.eq as ReturnType<typeof vi.fn>
    const calls = eqFn.mock.calls as Array<[string, unknown]>
    expect(calls.some(([col, val]) => col === 'user_id' && val === 'user-1')).toBe(true)
  })

  it('delete 失敗時はエラー', async () => {
    setChainResult({ data: null, error: { message: 'delete failed' } })
    const result = await revokeShare({ pageId: PAGE_ID, permission: 'view' })
    expect(result).toMatchObject({ success: false })
  })
})

describe('listShares', () => {
  it('未認証は空配列 + error', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await listShares({ pageId: PAGE_ID })
    expect(result.data).toEqual([])
    expect(result.error).toBeTruthy()
  })

  it('view/edit の共有を返す', async () => {
    setChainResult({
      data: [
        { token: 'tok-view', permission: 'view' },
        { token: 'tok-edit', permission: 'edit' },
      ],
      error: null,
    })
    const result = await listShares({ pageId: PAGE_ID })
    expect(result.error).toBeUndefined()
    expect(result.data).toHaveLength(2)
    expect(result.data.find((s) => s.permission === 'edit')?.token).toBe('tok-edit')
  })

  it('DB エラー時は空配列 + error', async () => {
    setChainResult({ data: null, error: { message: 'db error' } })
    const result = await listShares({ pageId: PAGE_ID })
    expect(result.data).toEqual([])
    expect(result.error).toBeTruthy()
  })
})
