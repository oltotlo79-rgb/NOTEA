import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'
import { expectSuccess, expectError } from '../../helpers/action-result'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// admin クライアントのモック
type StorageFile = { name: string; metadata?: Record<string, unknown> | null }
type StorageListResult = { data: StorageFile[] | null; error: { message: string } | null }
type StorageRemoveResult = { data: unknown; error: { message: string } | null }

const mockAdminDeleteUser = vi.fn()
const mockAdminStorageBucket = {
  list: vi.fn<() => Promise<StorageListResult>>(async () => ({ data: [], error: null })),
  remove: vi.fn<() => Promise<StorageRemoveResult>>(async () => ({ data: null, error: null })),
}
const mockAdminClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  })),
  storage: {
    from: vi.fn(() => mockAdminStorageBucket),
  },
  auth: {
    admin: {
      deleteUser: mockAdminDeleteUser,
    },
  },
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockAdminClient,
}))

const { getProfile, updateProfile, deleteAccount } = await import('@/lib/actions/profile')

const USER_ID = 'a0000001-0000-4000-8000-000000000001'

beforeEach(() => {
  mockClient = createMockSupabaseClient({ user: { id: USER_ID, email: 'user@example.com' } })
  vi.clearAllMocks()
  mockAdminDeleteUser.mockResolvedValue({ error: null })
  mockAdminStorageBucket.list.mockResolvedValue({ data: [], error: null })
  mockAdminStorageBucket.remove.mockResolvedValue({ data: null, error: null })
})

// =====================
// getProfile
// =====================
describe('getProfile', () => {
  it('正常系: display_name と plan を返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({
      data: { display_name: 'Alice', plan: 'free' },
      error: null,
    })

    const result = await getProfile()
    expectSuccess(result)
    expect(result.data?.displayName).toBe('Alice')
    expect(result.data?.plan).toBe('free')
  })

  it('有料プランの場合は plan が paid', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({
      data: { display_name: 'Bob', plan: 'paid' },
      error: null,
    })

    const result = await getProfile()
    expectSuccess(result)
    expect(result.data?.plan).toBe('paid')
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })

    const result = await getProfile()
    expectError(result, 'ログイン')
  })

  it('プロフィールが存在しない場合は error を返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await getProfile()
    expectError(result)
  })

  it('DB エラー時は error を返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection error' },
    })

    const result = await getProfile()
    expectError(result)
  })
})

// =====================
// updateProfile
// =====================
describe('updateProfile', () => {
  it('正常系: 表示名を更新する', async () => {
    mockClient._defaultResult.current = { data: null, error: null }

    const result = await updateProfile({ displayName: 'NewName' })
    expectSuccess(result)
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })

    const result = await updateProfile({ displayName: 'NewName' })
    expectError(result, 'ログイン')
  })

  it('Zod 拒否: 空文字列', async () => {
    const result = await updateProfile({ displayName: '' })
    expectError(result)
  })

  it('Zod 拒否: 51文字以上', async () => {
    const result = await updateProfile({ displayName: 'a'.repeat(51) })
    expectError(result)
  })

  it('Zod 通過: 50文字は許可される', async () => {
    mockClient._defaultResult.current = { data: null, error: null }
    const result = await updateProfile({ displayName: 'a'.repeat(50) })
    expectSuccess(result)
  })

  it('DB エラー時は error を返す', async () => {
    mockClient._defaultResult.current = {
      data: null,
      error: { message: 'update error' },
    }

    const result = await updateProfile({ displayName: 'NewName' })
    expectError(result)
  })
})

// =====================
// deleteAccount
// =====================
describe('deleteAccount', () => {
  const VALID_CONFIRMATION = 'delete my account'

  it('正常系: admin の deleteUser が呼ばれる', async () => {
    const result = await deleteAccount({ confirmation: VALID_CONFIRMATION })
    expectSuccess(result)
    expect(mockAdminDeleteUser).toHaveBeenCalledWith(USER_ID)
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })

    const result = await deleteAccount({ confirmation: VALID_CONFIRMATION })
    expectError(result, 'ログイン')
    expect(mockAdminDeleteUser).not.toHaveBeenCalled()
  })

  it('confirmation が不一致なら削除しない', async () => {
    const result = await deleteAccount({ confirmation: 'wrong text' })
    expectError(result, '確認テキスト')
    expect(mockAdminDeleteUser).not.toHaveBeenCalled()
  })

  it('confirmation が空文字の場合も拒否する', async () => {
    const result = await deleteAccount({ confirmation: '' })
    expectError(result)
    expect(mockAdminDeleteUser).not.toHaveBeenCalled()
  })

  it('admin.deleteUser がエラーを返した場合は error を返す', async () => {
    mockAdminDeleteUser.mockResolvedValueOnce({ error: { message: 'delete failed' } })

    const result = await deleteAccount({ confirmation: VALID_CONFIRMATION })
    expectError(result)
  })

  it('Storage に画像がある場合は削除してから DB 削除する', async () => {
    mockAdminStorageBucket.list
      .mockResolvedValueOnce({
        data: [{ name: 'page-id-1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ name: 'image.webp' }],
        error: null,
      })

    const result = await deleteAccount({ confirmation: VALID_CONFIRMATION })
    expectSuccess(result)

    // Storage の remove が呼ばれたことを確認
    expect(mockAdminStorageBucket.remove).toHaveBeenCalled()
    // 最終的に deleteUser が呼ばれたことを確認
    expect(mockAdminDeleteUser).toHaveBeenCalledWith(USER_ID)
  })
})
