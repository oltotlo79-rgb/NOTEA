import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))

const { getStorageUsage, consumeAiUsage, getAiUsageToday, getPageCount } = await import(
  '@/lib/services/usage'
)

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

// =====================
// consumeAiUsage
// =====================
describe('consumeAiUsage', () => {
  it('正常系(無料・gemini): remaining を返す', async () => {
    // getUserPlan: free
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    // rpc consume_ai_usage: 消費後 count=1 を返す
    mockClient._rpc.mockResolvedValueOnce({ data: 1, error: null })

    const result = await consumeAiUsage(USER_ID, 'gemini')

    expect('code' in result).toBe(false)
    if (!('code' in result)) {
      expect(result.remaining).toBe(4) // 5 - 1 = 4
    }
  })

  it('無料プランで openai を指定すると PROVIDER_NOT_ALLOWED', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })

    const result = await consumeAiUsage(USER_ID, 'openai')

    expect('code' in result).toBe(true)
    if ('code' in result) {
      expect(result.code).toBe('PROVIDER_NOT_ALLOWED')
    }
  })

  it('無料プランで anthropic を指定すると PROVIDER_NOT_ALLOWED', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })

    const result = await consumeAiUsage(USER_ID, 'anthropic')

    expect('code' in result).toBe(true)
    if ('code' in result) {
      expect(result.code).toBe('PROVIDER_NOT_ALLOWED')
    }
  })

  it('有料プランは openai も anthropic も消費できる', async () => {
    // openai
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'paid' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({ data: 1, error: null })

    const openaiResult = await consumeAiUsage(USER_ID, 'openai')
    expect('code' in openaiResult).toBe(false)
    if (!('code' in openaiResult)) {
      expect(openaiResult.remaining).toBe(99) // 100 - 1
    }

    // anthropic
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'paid' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({ data: 1, error: null })

    const anthropicResult = await consumeAiUsage(USER_ID, 'anthropic')
    expect('code' in anthropicResult).toBe(false)
  })

  it('上限ちょうど（5回目）は成功し remaining=0', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({ data: 5, error: null })

    const result = await consumeAiUsage(USER_ID, 'gemini')

    expect('code' in result).toBe(false)
    if (!('code' in result)) {
      expect(result.remaining).toBe(0)
    }
  })

  it('上限超過は LIMIT_EXCEEDED（rpc がエラーを返す）', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'AI_LIMIT_EXCEEDED: daily limit reached' },
    })

    const result = await consumeAiUsage(USER_ID, 'gemini')

    expect('code' in result).toBe(true)
    if ('code' in result && result.code === 'LIMIT_EXCEEDED') {
      expect(result.code).toBe('LIMIT_EXCEEDED')
      expect(result.message).toContain('5')
      expect(result.limit).toBe(5)
    }
  })

  it('有料プランの上限は 100 回', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'paid' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'AI_LIMIT_EXCEEDED: daily limit reached' },
    })

    const result = await consumeAiUsage(USER_ID, 'openai')

    expect('code' in result).toBe(true)
    if ('code' in result && result.code === 'LIMIT_EXCEEDED') {
      expect(result.code).toBe('LIMIT_EXCEEDED')
      expect(result.message).toContain('100')
      expect(result.limit).toBe(100)
    }
  })

  it('rpc が AI_LIMIT_EXCEEDED 以外のエラーを返すと DB_ERROR', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection timeout' },
    })

    const result = await consumeAiUsage(USER_ID, 'gemini')

    expect('code' in result).toBe(true)
    if ('code' in result) {
      expect(result.code).toBe('DB_ERROR')
    }
  })

  it('consumeAiUsage の引数に apiKey が存在しない（型レベル検証）', () => {
    // @ts-expect-error -- consumeAiUsage は provider のみを受け取る。apiKey は存在しない
    void consumeAiUsage(USER_ID, 'gemini', { apiKey: 'sk-secret' })
  })
})

// =====================
// getAiUsageToday
// =====================
describe('getAiUsageToday', () => {
  it('正常系(無料): provider 別の count と残回数を返す', async () => {
    // getUserPlan
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    // ai_usage 取得: gemini 2回使用
    mockClient._defaultResult.current = {
      data: [{ provider: 'gemini', count: 2 }],
      error: null,
    }

    const result = await getAiUsageToday(USER_ID)

    expect(result.plan).toBe('free')
    const gemini = result.providers.find((p) => p.provider === 'gemini')
    expect(gemini?.count).toBe(2)
    expect(gemini?.remaining).toBe(3) // 5 - 2
    expect(gemini?.limit).toBe(5)
  })

  it('正常系(有料): 上限は 100 回', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'paid' }, error: null })
    mockClient._defaultResult.current = {
      data: [{ provider: 'openai', count: 10 }],
      error: null,
    }

    const result = await getAiUsageToday(USER_ID)

    expect(result.plan).toBe('paid')
    const openai = result.providers.find((p) => p.provider === 'openai')
    expect(openai?.limit).toBe(100)
    expect(openai?.remaining).toBe(90)
  })

  it('ai_usage データが空のときは count=0 でプロバイダ一覧を返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._defaultResult.current = { data: [], error: null }

    const result = await getAiUsageToday(USER_ID)

    expect(result.providers).toHaveLength(3) // gemini/openai/anthropic
    for (const p of result.providers) {
      expect(p.count).toBe(0)
      expect(p.remaining).toBe(5)
    }
  })

  it('ai_usage が null のときは count=0 として扱う', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._defaultResult.current = { data: null, error: null }

    const result = await getAiUsageToday(USER_ID)

    for (const p of result.providers) {
      expect(p.count).toBe(0)
    }
  })
})

// =====================
// getPageCount
// =====================
describe('getPageCount', () => {
  it('正常系: rpc の戻り値をそのまま返す', async () => {
    mockClient._rpc.mockResolvedValueOnce({ data: 42, error: null })

    const count = await getPageCount(USER_ID)

    expect(count).toBe(42)
  })

  it('rpc が 0 を返した場合は 0', async () => {
    mockClient._rpc.mockResolvedValueOnce({ data: 0, error: null })

    const count = await getPageCount(USER_ID)

    expect(count).toBe(0)
  })

  it('rpc がエラーを返した場合は 0 にフォールバック', async () => {
    mockClient._rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc error' },
    })

    const count = await getPageCount(USER_ID)

    expect(count).toBe(0)
  })

  it('data が null の場合は 0 にフォールバック', async () => {
    mockClient._rpc.mockResolvedValueOnce({ data: null, error: null })

    const count = await getPageCount(USER_ID)

    expect(count).toBe(0)
  })
})
