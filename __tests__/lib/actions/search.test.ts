import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))

const { searchPages } = await import('@/lib/actions/search')

// Zod v4 uuid: バージョン 4、バリアント [89ab]
const ID_1 = 'a0000001-0000-4000-8000-000000000001'
const ID_2 = 'a0000002-0000-4000-8000-000000000002'

const NOW = '2026-06-17T00:00:00.000Z'
const EARLIER = '2026-06-16T00:00:00.000Z'

const PAGE_ROW_1 = {
  id: ID_1,
  title: 'Next.js の使い方',
  icon: null,
  content_text: 'Next.js は React フレームワークです',
  updated_at: NOW,
}
const PAGE_ROW_2 = {
  id: ID_2,
  title: 'TypeScript 入門',
  icon: '📘',
  content_text: 'TypeScript は型付き JavaScript です',
  updated_at: EARLIER,
}

function setBuilderResult(
  client: MockSupabaseClient,
  result: { data: unknown; error: { message: string } | null }
) {
  client._defaultResult.current = result as { data: unknown; error: { message: string } | null }
}

beforeEach(() => {
  mockClient = createMockSupabaseClient()
  setBuilderResult(mockClient, { data: null, error: null })
})

// ========================
// searchPages
// ========================
describe('searchPages', () => {
  it('正常系: クエリに一致するページを返す', async () => {
    setBuilderResult(mockClient, { data: [PAGE_ROW_1, PAGE_ROW_2], error: null })

    const result = await searchPages('Next.js')
    expect(result.error).toBeUndefined()
    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toMatchObject({
      id: ID_1,
      title: 'Next.js の使い方',
      icon: null,
      updatedAt: NOW,
    })
    // スニペットに content_text の一部が含まれる
    expect(result.data[0]?.snippet).toContain('Next.js')
  })

  it('未認証はエラーを返し data は空配列', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await searchPages('hello')
    expect(result.error).toBeTruthy()
    expect(result.data).toEqual([])
  })

  it('空文字クエリは DB に問い合わせず data:[] を返す', async () => {
    const result = await searchPages('')
    expect(result.data).toEqual([])
    expect(result.error).toBeUndefined()
    // from() が呼ばれていないことで DB アクセスなしを確認
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it('空白のみクエリも data:[] を返す（DB 不問い合わせ）', async () => {
    const result = await searchPages('   ')
    expect(result.data).toEqual([])
    expect(mockClient.from).not.toHaveBeenCalled()
  })

  it('MAX_SEARCH_QUERY_LENGTH(100文字)超はエラーを返す', async () => {
    const longQuery = 'あ'.repeat(101)
    const result = await searchPages(longQuery)
    expect(result.error).toBeTruthy()
    expect(result.data).toEqual([])
  })

  it('正確に 100 文字のクエリは許可される', async () => {
    setBuilderResult(mockClient, { data: [], error: null })
    const query = 'a'.repeat(100)
    const result = await searchPages(query)
    expect(result.error).toBeUndefined()
    expect(result.data).toEqual([])
  })

  it('カーソルが指定されると lt フィルタを適用する', async () => {
    setBuilderResult(mockClient, { data: [PAGE_ROW_2], error: null })

    const result = await searchPages('TypeScript', NOW)
    expect(result.error).toBeUndefined()
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.id).toBe(ID_2)

    // builder に lt が呼ばれていることを確認
    const ltFn = mockClient._builder.lt as ReturnType<typeof vi.fn>
    expect(ltFn).toHaveBeenCalledWith('updated_at', NOW)
  })

  it('SEARCH_PAGE_SIZE(20件)満杯のとき nextCursor を返す', async () => {
    const twentyRows = Array.from({ length: 20 }, (_, i) => ({
      id: `a${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`,
      title: `ページ ${i}`,
      icon: null,
      content_text: 'テスト本文',
      updated_at: `2026-06-${String(17 - i).padStart(2, '0')}T00:00:00.000Z`,
    }))
    setBuilderResult(mockClient, { data: twentyRows, error: null })

    const result = await searchPages('テスト')
    expect(result.nextCursor).toBe(twentyRows[19]?.updated_at)
  })

  it('SEARCH_PAGE_SIZE 未満のとき nextCursor は undefined', async () => {
    setBuilderResult(mockClient, { data: [PAGE_ROW_1], error: null })

    const result = await searchPages('Next.js')
    expect(result.nextCursor).toBeUndefined()
  })

  it('.eq("user_id", userId) が呼ばれる（多層防御）', async () => {
    setBuilderResult(mockClient, { data: [], error: null })

    await searchPages('test')

    const eqFn = mockClient._builder.eq as ReturnType<typeof vi.fn>
    const calls = eqFn.mock.calls as Array<[string, unknown]>
    const hasUserIdFilter = calls.some(([col, val]) => col === 'user_id' && val === 'user-1')
    expect(hasUserIdFilter).toBe(true)
  })

  it('.eq("is_trashed", false) が呼ばれる（ごみ箱除外）', async () => {
    setBuilderResult(mockClient, { data: [], error: null })

    await searchPages('test')

    const eqFn = mockClient._builder.eq as ReturnType<typeof vi.fn>
    const calls = eqFn.mock.calls as Array<[string, unknown]>
    const hasTrashedFilter = calls.some(([col, val]) => col === 'is_trashed' && val === false)
    expect(hasTrashedFilter).toBe(true)
  })

  it('DB エラー時は error を返し data は空配列', async () => {
    setBuilderResult(mockClient, { data: null, error: { message: 'DB connection failed' } })

    const result = await searchPages('hello')
    expect(result.error).toBeTruthy()
    expect(result.data).toEqual([])
  })

  it('スニペットに一致箇所が含まれる', async () => {
    const row = {
      id: ID_1,
      title: 'タイトル',
      icon: null,
      content_text: 'これは検索対象のテキストです。検索ワードが含まれています。',
      updated_at: NOW,
    }
    setBuilderResult(mockClient, { data: [row], error: null })

    const result = await searchPages('検索ワード')
    expect(result.data[0]?.snippet).toContain('検索ワード')
  })

  it('content_text が空のとき snippet は空文字', async () => {
    const row = {
      id: ID_1,
      title: 'タイトルのみのページ',
      icon: null,
      content_text: '',
      updated_at: NOW,
    }
    setBuilderResult(mockClient, { data: [row], error: null })

    const result = await searchPages('タイトル')
    expect(result.data[0]?.snippet).toBe('')
  })
})
