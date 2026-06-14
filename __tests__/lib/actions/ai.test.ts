import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))

// services/usage をモックして actions のテストに集中する
// factory 内で vi.fn() を直接返す（hoisting により factory 外の変数は undefined になるため）
vi.mock('@/lib/services/usage', () => ({
  consumeAiUsage: vi.fn(),
  getAiUsageToday: vi.fn(),
  getStorageUsage: vi.fn(),
}))

const { consumeAiUsage, getAiUsageToday } = await import('@/lib/actions/ai')

// モックされた services/usage の関数を取得する
const { consumeAiUsage: mockServiceConsumeAiUsage, getAiUsageToday: mockServiceGetAiUsageToday } =
  await import('@/lib/services/usage')

const USER_ID = 'a0000001-0000-4000-8000-000000000001'

beforeEach(() => {
  mockClient = createMockSupabaseClient({ user: { id: USER_ID } })
  vi.clearAllMocks()
})

// =====================
// consumeAiUsage Action
// =====================
describe('consumeAiUsage Action', () => {
  it('正常系: gemini を消費して remaining を返す', async () => {
    vi.mocked(mockServiceConsumeAiUsage).mockResolvedValueOnce({ remaining: 4 })

    const result = await consumeAiUsage('gemini')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data?.remaining).toBe(4)
    }
  })

  it('未認証は error を返す（ERR_AUTH_REQUIRED）', async () => {
    mockClient = createMockSupabaseClient({ user: null })

    const result = await consumeAiUsage('gemini')

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('ログイン')
  })

  it('Zod 拒否: 不正な provider 文字列', async () => {
    // @ts-expect-error -- 意図的に不正な provider を渡してバリデーションを確認する
    const result = await consumeAiUsage('unknown-provider')

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
    // services は呼ばれない
    expect(mockServiceConsumeAiUsage).not.toHaveBeenCalled()
  })

  it('プラン違反（無料で openai）は ERR_AI_PROVIDER_NOT_ALLOWED を返す', async () => {
    vi.mocked(mockServiceConsumeAiUsage).mockResolvedValueOnce({
      code: 'PROVIDER_NOT_ALLOWED',
      message: 'このプロバイダは有料プランでのみ利用できます',
    })

    const result = await consumeAiUsage('openai')

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('有料プラン')
  })

  it('上限超過は ERR_AI_LIMIT_REACHED を返す（回数を含む）', async () => {
    vi.mocked(mockServiceConsumeAiUsage).mockResolvedValueOnce({
      code: 'LIMIT_EXCEEDED',
      message: 'AI の利用回数が本日の上限（5回）に達しました',
    })

    const result = await consumeAiUsage('gemini')

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('5')
  })

  it('DB エラーは ERR_AI_FAILED を返す', async () => {
    vi.mocked(mockServiceConsumeAiUsage).mockResolvedValueOnce({
      code: 'DB_ERROR',
      message: 'データの読み書きに失敗しました',
    })

    const result = await consumeAiUsage('gemini')

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('失敗')
  })

  it('引数型に apiKey フィールドが存在しないことを型レベルで検証', () => {
    // consumeAiUsage は AiProvider のみを引数に取る。apiKey は引数に存在してはいけない。
    // 第1引数は AiProvider
    const _provider: Parameters<typeof consumeAiUsage>[0] = 'gemini'
    void _provider
    // 引数の数は 1 つのみ。第2引数に apiKey を渡すことは型エラーになる。
    const _length: Parameters<typeof consumeAiUsage>['length'] = 1
    void _length
  })

  it('consumeAiUsage の第一引数は AiProvider 型のみ（型レベル検証）', () => {
    // 型が正しく定義されていれば型エラーにならない（実行はしない）
    const _gemini: Parameters<typeof consumeAiUsage>[0] = 'gemini'
    const _openai: Parameters<typeof consumeAiUsage>[0] = 'openai'
    const _anthropic: Parameters<typeof consumeAiUsage>[0] = 'anthropic'
    // 未使用変数の lint 警告を回避
    void _gemini
    void _openai
    void _anthropic
  })
})

// =====================
// getAiUsageToday Action
// =====================
describe('getAiUsageToday Action', () => {
  it('正常系: provider 別使用状況と plan を返す', async () => {
    vi.mocked(mockServiceGetAiUsageToday).mockResolvedValueOnce({
      providers: [
        { provider: 'gemini', count: 2, remaining: 3, limit: 5 },
        { provider: 'openai', count: 0, remaining: 5, limit: 5 },
        { provider: 'anthropic', count: 0, remaining: 5, limit: 5 },
      ],
      plan: 'free',
    })

    const result = await getAiUsageToday()

    expect(result.plan).toBe('free')
    expect(result.limit).toBe(5)
    expect(result.providers).toHaveLength(3)
    expect(result.error).toBeUndefined()
  })

  it('未認証はエラーフィールド付きで空の providers を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })

    const result = await getAiUsageToday()

    expect(result.error).toContain('ログイン')
    expect(result.providers).toHaveLength(0)
  })

  it('有料プランの limit は 100', async () => {
    vi.mocked(mockServiceGetAiUsageToday).mockResolvedValueOnce({
      providers: [{ provider: 'openai', count: 10, remaining: 90, limit: 100 }],
      plan: 'paid',
    })

    const result = await getAiUsageToday()

    expect(result.limit).toBe(100)
    expect(result.plan).toBe('paid')
  })
})
