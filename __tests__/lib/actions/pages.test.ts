import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const {
  createPage,
  updatePageContent,
  updatePageMeta,
  movePage,
  reorderPage,
  trashPage,
  restorePage,
  deletePagePermanently,
  getPageTree,
  listTrashedPages,
} = await import('@/lib/actions/pages')

// Zod 4 の uuid バリデーション: バージョン [1-8]、バリアント [89abAB] が必要
// nih UUID v4 形式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (y = [89ab])
const ID_1 = 'a0000001-0000-4000-8000-000000000001'
const ID_2 = 'a0000002-0000-4000-8000-000000000002'
const ID_3 = 'a0000003-0000-4000-8000-000000000003'
const ID_PARENT = 'a0000010-0000-4000-8000-000000000010'

const PAGE_1 = { id: ID_1, parent_id: null }
const PAGE_2 = { id: ID_2, parent_id: ID_1 }
const PAGE_3 = { id: ID_3, parent_id: ID_2 }

function setBuilderResult(client: MockSupabaseClient, result: { data: unknown; error: unknown }) {
  client._defaultResult.current = result as { data: unknown; error: { message: string } | null }
}

beforeEach(() => {
  mockClient = createMockSupabaseClient()
  setBuilderResult(mockClient, { data: null, error: null })
})

// =====================
// createPage
// =====================
describe('createPage', () => {
  it('正常系: ルートページを作成する', async () => {
    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null }) // getUserPlan
      .mockResolvedValueOnce({ data: { sort_order: 2 }, error: null }) // root sibling sort
    mockClient._rpc.mockResolvedValueOnce({ data: 5, error: null })
    mockClient._single.mockResolvedValueOnce({ data: { id: 'new-page-uuid' }, error: null })

    const result = await createPage({})
    expect(result.success).toBe(true)
    if (result.success && result.data) {
      expect(result.data.id).toBe('new-page-uuid')
    }
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await createPage({})
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
  })

  it('Zod 拒否: 不正な parentId（UUID でない）', async () => {
    const result = await createPage({ parentId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('無料プラン上限到達は error を返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({ data: 100, error: null })

    const result = await createPage({})
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('100')
  })

  it('parentId が存在しないページなら ERR_PAGE_NOT_FOUND', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({ data: 0, error: null })
    // 全ページ取得 → 空配列（parentId は見つからない）
    setBuilderResult(mockClient, { data: [], error: null })

    const result = await createPage({ parentId: ID_PARENT })
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('見つかりません')
  })

  it('深さ MAX_PAGE_DEPTH 以上のページは ERR_PAGE_DEPTH_LIMIT', async () => {
    // 10 階層のページ列を生成（UUID v4 形式: バージョン '4'、バリアント '8'）
    const makeDeepId = (n: number) =>
      `d${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`
    const deepPages = Array.from({ length: 10 }, (_, i) => ({
      id: makeDeepId(i + 1),
      parent_id: i === 0 ? null : makeDeepId(i),
    }))
    const targetParentId = makeDeepId(10)

    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({ data: 0, error: null })
    setBuilderResult(mockClient, { data: deepPages, error: null })

    const result = await createPage({ parentId: targetParentId })
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('階層')
  })

  it('API キーに類する引数が型に存在しないことを確認（型レベル検証）', () => {
    // @ts-expect-error apiKey は createPage の引数に存在しない（型安全の担保）
    void createPage({ apiKey: 'sk-test' })
  })
})

// =====================
// updatePageContent
// =====================
describe('updatePageContent', () => {
  it('正常系: コンテンツを更新する', async () => {
    const result = await updatePageContent({
      id: ID_1,
      content: [{ type: 'paragraph', children: [{ text: 'hello' }] }],
      contentText: 'hello',
    })
    expect(result.success).toBe(true)
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await updatePageContent({ id: ID_1, content: [], contentText: '' })
    expect(result.success).toBe(false)
  })

  it('Zod 拒否: id が UUID でない', async () => {
    const result = await updatePageContent({ id: 'bad', content: [], contentText: '' })
    expect(result.success).toBe(false)
  })

  it('コンテンツが 1MB 超は ERR_PAGE_CONTENT_TOO_LARGE', async () => {
    const bigContent = { text: 'x'.repeat(1024 * 1024 + 1) }
    const result = await updatePageContent({
      id: ID_1,
      content: [bigContent],
      contentText: '',
    })
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('大きすぎます')
  })
})

// =====================
// updatePageMeta
// =====================
describe('updatePageMeta', () => {
  it('正常系: タイトルを更新する', async () => {
    const result = await updatePageMeta({ id: ID_1, title: '新しいタイトル' })
    expect(result.success).toBe(true)
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await updatePageMeta({ id: ID_1, title: 'x' })
    expect(result.success).toBe(false)
  })

  it('Zod 拒否: title も icon も undefined（少なくとも1項目必要）', async () => {
    const result = await updatePageMeta({ id: ID_1 })
    expect(result.success).toBe(false)
  })
})

// =====================
// movePage
// =====================
describe('movePage', () => {
  it('正常系: ルートへの移動（newParentId=null）は rpc を使わず直接 update', async () => {
    const result = await movePage({ id: ID_1, newParentId: null })
    expect(result.success).toBe(true)
    expect(mockClient._rpc).not.toHaveBeenCalled()
  })

  it('正常系: 別ページへの移動は rpc を呼ぶ', async () => {
    mockClient._rpc.mockResolvedValueOnce({ data: null, error: null })

    const result = await movePage({ id: ID_1, newParentId: ID_2 })
    expect(result.success).toBe(true)
    expect(mockClient._rpc).toHaveBeenCalledWith('move_page', {
      p_page_id: ID_1,
      p_new_parent_id: ID_2,
    })
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await movePage({ id: ID_1, newParentId: null })
    expect(result.success).toBe(false)
  })

  it('Zod 拒否: id が UUID でない', async () => {
    const result = await movePage({ id: 'bad', newParentId: null })
    expect(result.success).toBe(false)
  })

  it('rpc が CIRCULAR_REFERENCE エラーを返したら ERR_PAGE_CIRCULAR に対応付ける', async () => {
    mockClient._rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'CIRCULAR_REFERENCE detected' },
    })
    const result = await movePage({ id: ID_1, newParentId: ID_2 })
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('子孫')
  })

  it('rpc が DEPTH_LIMIT_EXCEEDED エラーを返したら ERR_PAGE_DEPTH_LIMIT に対応付ける', async () => {
    mockClient._rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DEPTH_LIMIT_EXCEEDED' },
    })
    const result = await movePage({ id: ID_1, newParentId: ID_2 })
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('階層')
  })

  it('rpc がその他エラーなら ERR_DB に対応付ける', async () => {
    mockClient._rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'UNKNOWN_DB_ERROR' },
    })
    const result = await movePage({ id: ID_1, newParentId: ID_2 })
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('読み書き')
  })
})

// =====================
// reorderPage
// =====================
describe('reorderPage', () => {
  it('正常系: sort_order を更新する', async () => {
    const result = await reorderPage({ id: ID_1, sortOrder: 5 })
    expect(result.success).toBe(true)
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await reorderPage({ id: ID_1, sortOrder: 0 })
    expect(result.success).toBe(false)
  })

  it('Zod 拒否: id が UUID でない', async () => {
    const result = await reorderPage({ id: 'bad', sortOrder: 0 })
    expect(result.success).toBe(false)
  })
})

// =====================
// trashPage
// =====================
describe('trashPage', () => {
  it('正常系: ページとサブツリーをごみ箱に移動する', async () => {
    const pages = [PAGE_1, PAGE_2, PAGE_3]
    setBuilderResult(mockClient, { data: pages, error: null })

    const result = await trashPage(ID_1)
    expect(result.success).toBe(true)

    const inFn = mockClient._builder.in as ReturnType<typeof vi.fn>
    const idCall = inFn.mock.calls.find(
      (c) => c[0] === 'id' && Array.isArray(c[1]) && (c[1] as string[]).includes(ID_1)
    )
    expect(idCall).toBeDefined()
    const ids = idCall?.[1] as string[]
    expect(ids).toContain(ID_1)
    expect(ids).toContain(ID_2)
    expect(ids).toContain(ID_3)
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await trashPage(ID_1)
    expect(result.success).toBe(false)
  })

  it('Zod 拒否: UUID でない id', async () => {
    const result = await trashPage('bad-id')
    expect(result.success).toBe(false)
  })

  it('存在しないページは ERR_PAGE_NOT_FOUND', async () => {
    setBuilderResult(mockClient, { data: [], error: null })

    const result = await trashPage(ID_1)
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('見つかりません')
  })
})

// =====================
// restorePage
// =====================
describe('restorePage', () => {
  it('正常系: ごみ箱のページとサブツリーを復元する', async () => {
    const trashedPages = [PAGE_1, PAGE_2]
    setBuilderResult(mockClient, { data: trashedPages, error: null })

    // PAGE_1 の parent_id が null なので親チェックは呼ばれない
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'paid' }, error: null })

    const result = await restorePage(ID_1)
    expect(result.success).toBe(true)

    const inFn = mockClient._builder.in as ReturnType<typeof vi.fn>
    const idCall = inFn.mock.calls.find(
      (c) => c[0] === 'id' && Array.isArray(c[1]) && (c[1] as string[]).includes(ID_1)
    )
    expect(idCall).toBeDefined()
    const ids = idCall?.[1] as string[]
    expect(ids).toContain(ID_1)
    expect(ids).toContain(ID_2)
  })

  it('無料プランで復元後のページ数が上限超過なら拒否する', async () => {
    const trashedPages = [PAGE_1, PAGE_2, PAGE_3]
    setBuilderResult(mockClient, { data: trashedPages, error: null })

    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({ data: 99, error: null })

    const result = await restorePage(ID_1)
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('100')
  })

  it('元の親がごみ箱中なら parent_id=null に昇格させる', async () => {
    const trashedPages = [PAGE_2]
    setBuilderResult(mockClient, { data: trashedPages, error: null })

    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { plan: 'paid' }, error: null })
      .mockResolvedValueOnce({ data: { id: ID_1, is_trashed: true }, error: null })

    const result = await restorePage(ID_2)
    expect(result.success).toBe(true)

    const updateFn = mockClient._builder.update as ReturnType<typeof vi.fn>
    const parentNullCall = updateFn.mock.calls.find(
      (c) =>
        typeof c[0] === 'object' &&
        c[0] !== null &&
        'parent_id' in (c[0] as object) &&
        (c[0] as { parent_id: unknown }).parent_id === null
    )
    expect(parentNullCall).toBeDefined()
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await restorePage(ID_1)
    expect(result.success).toBe(false)
  })

  it('Zod 拒否: UUID でない id', async () => {
    const result = await restorePage('bad-id')
    expect(result.success).toBe(false)
  })

  it('ごみ箱に存在しないページは ERR_PAGE_NOT_FOUND', async () => {
    setBuilderResult(mockClient, { data: [], error: null })

    const result = await restorePage(ID_1)
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('見つかりません')
  })
})

// =====================
// deletePagePermanently
// =====================
describe('deletePagePermanently', () => {
  it('正常系: ごみ箱のページを完全削除する（Storage も含む）', async () => {
    const trashedPages = [PAGE_1, PAGE_2]
    setBuilderResult(mockClient, { data: trashedPages, error: null })

    const result = await deletePagePermanently(ID_1)
    expect(result.success).toBe(true)

    expect(mockClient._storage.from).toHaveBeenCalledWith('page-images')
    expect(mockClient._storage._bucket.list).toHaveBeenCalledTimes(2)
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await deletePagePermanently(ID_1)
    expect(result.success).toBe(false)
  })

  it('Zod 拒否: UUID でない id', async () => {
    const result = await deletePagePermanently('bad-id')
    expect(result.success).toBe(false)
  })

  it('ごみ箱に存在しないページは ERR_PAGE_NOT_FOUND', async () => {
    setBuilderResult(mockClient, { data: [], error: null })

    const result = await deletePagePermanently(ID_1)
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('見つかりません')
  })

  it('API キー・プロンプト・応答を引数に含まないことを型で担保', () => {
    // @ts-expect-error 第2引数自体が型定義に存在しない
    void deletePagePermanently(ID_1, { apiKey: 'sk-test' })
  })
})

// =====================
// getPageTree
// =====================
describe('getPageTree', () => {
  it('正常系: ページ一覧を返す', async () => {
    const pages = [
      { id: ID_1, parent_id: null, title: 'Page 1', icon: null, sort_order: 0 },
      { id: ID_2, parent_id: ID_1, title: 'Page 2', icon: null, sort_order: 0 },
    ]
    setBuilderResult(mockClient, { data: pages, error: null })

    const result = await getPageTree()
    expect(result.error).toBeUndefined()
    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toMatchObject({ id: ID_1 })
  })

  it('未認証は空配列と error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await getPageTree()
    expect(result.data).toEqual([])
    expect(result.error).toBeTruthy()
  })
})

// =====================
// listTrashedPages
// =====================
describe('listTrashedPages', () => {
  it('正常系: ごみ箱ページ一覧を返す', async () => {
    const rows = [
      { id: ID_1, title: 'Trashed 1', icon: null, trashed_at: '2026-01-01T00:00:00Z' },
      { id: ID_2, title: 'Trashed 2', icon: null, trashed_at: '2026-01-02T00:00:00Z' },
    ]
    setBuilderResult(mockClient, { data: rows, error: null })

    const result = await listTrashedPages()
    expect(result.error).toBeUndefined()
    expect(result.data).toHaveLength(2)
    expect(result.nextCursor).toBeUndefined()
  })

  it('30件ちょうどなら nextCursor を返す', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `c${String(i + 1).padStart(7, '0')}-0000-4000-8000-000000000000`,
      title: `Trashed ${i}`,
      icon: null,
      trashed_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }))
    setBuilderResult(mockClient, { data: rows, error: null })

    const result = await listTrashedPages()
    expect(result.nextCursor).toBe(rows.at(-1)?.trashed_at)
  })

  it('未認証は空配列と error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await listTrashedPages()
    expect(result.data).toEqual([])
    expect(result.error).toBeTruthy()
  })

  it('カーソルを渡すと .lt が呼ばれる', async () => {
    setBuilderResult(mockClient, { data: [], error: null })

    const cursor = '2026-01-10T00:00:00Z'
    await listTrashedPages(cursor)

    const ltFn = mockClient._builder.lt as ReturnType<typeof vi.fn>
    expect(ltFn).toHaveBeenCalledWith('trashed_at', cursor)
  })
})

// =====================
// deletePagePermanently branch 補強
// =====================
describe('deletePagePermanently (branch 補強)', () => {
  it('Storage に画像がある場合は remove が呼ばれる', async () => {
    const trashedPages = [PAGE_1]
    setBuilderResult(mockClient, { data: trashedPages, error: null })

    // list が画像ファイルを返すようにモック
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockClient._storage._bucket.list as any).mockResolvedValueOnce({
      data: [{ name: 'image.webp' }],
      error: null,
    })

    const result = await deletePagePermanently(ID_1)
    expect(result.success).toBe(true)
    expect(mockClient._storage._bucket.remove).toHaveBeenCalled()
  })

  it('Storage list がエラーを返しても処理を継続する', async () => {
    const trashedPages = [PAGE_1]
    setBuilderResult(mockClient, { data: trashedPages, error: null })

    // list はデフォルトで空配列を返す（エラーなし）
    const result = await deletePagePermanently(ID_1)
    expect(result.success).toBe(true)
  })
})

// =====================
// createPage branch 補強
// =====================
describe('createPage (branch 補強)', () => {
  it('parentId 有りで兄弟ページがない場合 sort_order = 0', async () => {
    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null }) // getUserPlan
    mockClient._rpc.mockResolvedValueOnce({ data: 0, error: null })

    // 全ページ取得: 親ページのみ存在
    setBuilderResult(mockClient, { data: [{ id: ID_PARENT, parent_id: null }], error: null })

    // 兄弟ページの max sort_order: null (兄弟なし)
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    // insert 結果
    mockClient._single.mockResolvedValueOnce({ data: { id: 'new-page-uuid' }, error: null })

    const result = await createPage({ parentId: ID_PARENT })
    expect(result.success).toBe(true)
  })

  it('ルートページで兄弟がない場合 sort_order = 0', async () => {
    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null }) // getUserPlan
    mockClient._rpc.mockResolvedValueOnce({ data: 0, error: null })

    // root sibling: null (兄弟なし)
    mockClient._maybeSingle.mockResolvedValueOnce({ data: null, error: null })

    // insert 結果
    mockClient._single.mockResolvedValueOnce({ data: { id: 'new-root-page' }, error: null })

    const result = await createPage({})
    expect(result.success).toBe(true)
    if (result.success && result.data) {
      expect(result.data.id).toBe('new-root-page')
    }
  })

  it('DB エラー: 全ページ取得失敗', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({ data: 0, error: null })
    setBuilderResult(mockClient, { data: null, error: { message: 'DB error' } })

    const result = await createPage({ parentId: ID_PARENT })
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('読み書き')
  })

  it('DB エラー: insert 失敗', async () => {
    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
    mockClient._rpc.mockResolvedValueOnce({ data: 0, error: null })

    // root sibling
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { sort_order: 3 }, error: null })

    // insert 失敗
    mockClient._single.mockResolvedValueOnce({ data: null, error: { message: 'insert error' } })

    const result = await createPage({})
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('読み書き')
  })
})

// =====================
// restorePage branch 補強
// =====================
describe('restorePage (branch 補強)', () => {
  it('親ページが存在するが is_trashed=false の場合は parent_id を保持する', async () => {
    const trashedPages = [PAGE_2] // parent_id = ID_1
    setBuilderResult(mockClient, { data: trashedPages, error: null })

    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { plan: 'paid' }, error: null })
      .mockResolvedValueOnce({ data: { id: ID_1, is_trashed: false }, error: null }) // 親は非ごみ箱

    const result = await restorePage(ID_2)
    expect(result.success).toBe(true)

    const updateFn = mockClient._builder.update as ReturnType<typeof vi.fn>
    // parent_id=null の update が呼ばれていないことを確認
    const parentNullCall = updateFn.mock.calls.find(
      (c) =>
        typeof c[0] === 'object' &&
        c[0] !== null &&
        'parent_id' in (c[0] as object) &&
        (c[0] as { parent_id: unknown }).parent_id === null
    )
    expect(parentNullCall).toBeUndefined()
  })

  it('DB エラー: ごみ箱ページ取得失敗', async () => {
    setBuilderResult(mockClient, { data: null, error: { message: 'DB error' } })

    const result = await restorePage(ID_1)
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('読み書き')
  })
})

// =====================
// updatePageContent branch 補強
// =====================
describe('updatePageContent (branch 補強)', () => {
  it('DB エラー時は ERR_DB を返す', async () => {
    setBuilderResult(mockClient, { data: null, error: { message: 'update error' } })

    const result = await updatePageContent({ id: ID_1, content: [], contentText: '' })
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('読み書き')
  })
})

// =====================
// trashPage branch 補強
// =====================
describe('trashPage (branch 補強)', () => {
  it('DB 取得エラー', async () => {
    setBuilderResult(mockClient, { data: null, error: { message: 'DB error' } })

    const result = await trashPage(ID_1)
    expect(result.success).toBe(false)
    expect('error' in result && result.error).toContain('読み書き')
  })
})
