import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { signUp, signIn, signOut, requestPasswordReset, updatePassword } = await import(
  '@/lib/actions/auth'
)

beforeEach(() => {
  mockClient = createMockSupabaseClient()
})

describe('signUp', () => {
  it('正しい入力で成功する', async () => {
    const result = await signUp({ email: 'a@example.com', password: 'abcde123' })
    expect(result.success).toBe(true)
    expect(mockClient.auth.signUp).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'abcde123',
    })
  })
  it('ポリシー違反パスワードは Zod で拒否し signUp を呼ばない', async () => {
    const result = await signUp({ email: 'a@example.com', password: 'short' })
    expect(result.success).toBe(false)
    expect(mockClient.auth.signUp).not.toHaveBeenCalled()
  })
  it('Supabase エラー時は失敗を返す', async () => {
    mockClient = createMockSupabaseClient({ authResult: { error: { message: 'boom' } } })
    const result = await signUp({ email: 'a@example.com', password: 'abcde123' })
    expect(result.success).toBe(false)
  })
})

describe('signIn', () => {
  it('正しい入力で成功する', async () => {
    const result = await signIn({ email: 'a@example.com', password: 'x' })
    expect(result.success).toBe(true)
  })
  it('認証失敗時は汎用メッセージを返す（情報を漏らさない）', async () => {
    mockClient = createMockSupabaseClient({ authResult: { error: { message: 'Invalid login' } } })
    const result = await signIn({ email: 'a@example.com', password: 'wrong1234' })
    expect(result).toEqual({ success: false, error: expect.stringContaining('正しくありません') })
  })
  it('不正な入力は Zod で拒否', async () => {
    const result = await signIn({ email: 'bad', password: '' })
    expect(result.success).toBe(false)
    expect(mockClient.auth.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe('signOut', () => {
  it('signOut を呼び成功を返す', async () => {
    const result = await signOut()
    expect(result.success).toBe(true)
    expect(mockClient.auth.signOut).toHaveBeenCalled()
  })
})

describe('requestPasswordReset', () => {
  it('成功時もエラー時も成功を返す（メール存在の有無を漏らさない）', async () => {
    expect((await requestPasswordReset({ email: 'a@example.com' })).success).toBe(true)
    mockClient = createMockSupabaseClient({ authResult: { error: { message: 'not found' } } })
    expect((await requestPasswordReset({ email: 'a@example.com' })).success).toBe(true)
  })
  it('不正なメールは拒否', async () => {
    expect((await requestPasswordReset({ email: 'bad' })).success).toBe(false)
  })
})

describe('updatePassword', () => {
  it('リカバリーセッションがあれば更新できる', async () => {
    const result = await updatePassword({ password: 'newpass123' })
    expect(result.success).toBe(true)
    expect(mockClient.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' })
  })
  it('未認証なら失敗', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    expect((await updatePassword({ password: 'newpass123' })).success).toBe(false)
  })
  it('ポリシー違反は拒否', async () => {
    expect((await updatePassword({ password: 'short' })).success).toBe(false)
  })
})
