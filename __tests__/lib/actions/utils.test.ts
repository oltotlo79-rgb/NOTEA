import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))

const { requireUser, requirePaidUser, enforcePlanLimit } = await import('@/lib/actions/utils')

beforeEach(() => {
  mockClient = createMockSupabaseClient()
})

describe('requireUser', () => {
  it('認証済みなら userId を返す', async () => {
    expect(await requireUser()).toEqual({ userId: 'user-1' })
  })
  it('未認証なら error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await requireUser()
    expect('error' in result).toBe(true)
  })
})

describe('requirePaidUser', () => {
  it('有料プランなら userId を返す', async () => {
    mockClient = createMockSupabaseClient({ queryResult: { data: { plan: 'paid' }, error: null } })
    expect(await requirePaidUser()).toEqual({ userId: 'user-1' })
  })
  it('無料プランなら error を返す', async () => {
    mockClient = createMockSupabaseClient({ queryResult: { data: { plan: 'free' }, error: null } })
    const result = await requirePaidUser()
    expect('error' in result).toBe(true)
  })
  it('未認証なら error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await requirePaidUser()
    expect('error' in result).toBe(true)
  })
})

describe('enforcePlanLimit', () => {
  it('無料プランで上限未満なら null（許可）', async () => {
    mockClient = createMockSupabaseClient({
      queryResult: { data: { plan: 'free' }, error: null },
      rpcResult: { data: 99, error: null },
    })
    expect(await enforcePlanLimit('user-1', 'create_page')).toBeNull()
  })
  it('無料プランで上限到達なら error', async () => {
    mockClient = createMockSupabaseClient({
      queryResult: { data: { plan: 'free' }, error: null },
      rpcResult: { data: 100, error: null },
    })
    const result = await enforcePlanLimit('user-1', 'create_page')
    expect(result?.error).toContain('100')
  })
  it('有料プランなら常に null', async () => {
    mockClient = createMockSupabaseClient({ queryResult: { data: { plan: 'paid' }, error: null } })
    expect(await enforcePlanLimit('user-1', 'create_page')).toBeNull()
  })
  it('カウント取得失敗なら error（fail-closed）', async () => {
    mockClient = createMockSupabaseClient({
      queryResult: { data: { plan: 'free' }, error: null },
      rpcResult: { data: null, error: { message: 'db error' } },
    })
    expect(await enforcePlanLimit('user-1', 'create_page')).not.toBeNull()
  })
})
