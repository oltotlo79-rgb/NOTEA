import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { createUploadUrl, deleteImage } = await import('@/lib/actions/images')

// Zod v4 互換の UUID v4 形式
const USER_ID = 'a0000001-0000-4000-8000-000000000001'
const PAGE_ID = 'b0000001-0000-4000-8000-000000000001'
const VALID_WEBP_CONTENT_TYPE = 'image/webp'
const VALID_SIZE_BYTES = 1024 * 1024 // 1MB（上限 5MB 以内）
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const OVER_SIZE_BYTES = MAX_SIZE_BYTES + 1

beforeEach(() => {
  mockClient = createMockSupabaseClient({ user: { id: USER_ID } })
  // pages テーブルの所有確認: デフォルトでページが存在する
  mockClient._maybeSingle.mockResolvedValue({ data: { id: PAGE_ID }, error: null })
  // Storage list: デフォルトで空（容量0）
  mockClient._storage._bucket.list.mockResolvedValue({ data: [], error: null })
})

// =====================
// createUploadUrl
// =====================
describe('createUploadUrl', () => {
  it('正常系: 署名付きURLを発行してパス/トークンを返す', async () => {
    const result = await createUploadUrl({
      pageId: PAGE_ID,
      contentType: VALID_WEBP_CONTENT_TYPE,
      sizeBytes: VALID_SIZE_BYTES,
    })

    expect(result.success).toBe(true)
    if (result.success && result.data) {
      expect(result.data.path).toMatch(new RegExp(`^${USER_ID}/${PAGE_ID}/`))
      expect(result.data.path).toMatch(/\.webp$/)
      expect(result.data.token).toBeTruthy()
      expect(result.data.signedUrl).toBeTruthy()
    }
  })

  it('正常系: Storage バケット "page-images" が使われる', async () => {
    await createUploadUrl({
      pageId: PAGE_ID,
      contentType: VALID_WEBP_CONTENT_TYPE,
      sizeBytes: VALID_SIZE_BYTES,
    })

    expect(mockClient._storage.from).toHaveBeenCalledWith('page-images')
    expect(mockClient._storage._bucket.createSignedUploadUrl).toHaveBeenCalled()
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await createUploadUrl({
      pageId: PAGE_ID,
      contentType: VALID_WEBP_CONTENT_TYPE,
      sizeBytes: VALID_SIZE_BYTES,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeTruthy()
  })

  it('Zod 拒否: pageId が UUID でない', async () => {
    const result = await createUploadUrl({
      pageId: 'not-a-uuid',
      contentType: VALID_WEBP_CONTENT_TYPE,
      sizeBytes: VALID_SIZE_BYTES,
    })

    expect(result.success).toBe(false)
  })

  it('Zod 拒否: contentType が image/webp でない（PNG）', async () => {
    const result = await createUploadUrl({
      pageId: PAGE_ID,
      // @ts-expect-error 非 webp を意図的に渡す
      contentType: 'image/png',
      sizeBytes: VALID_SIZE_BYTES,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('WebP')
  })

  it('Zod 拒否: contentType が image/webp でない（JPEG）', async () => {
    const result = await createUploadUrl({
      pageId: PAGE_ID,
      // @ts-expect-error 非 webp を意図的に渡す
      contentType: 'image/jpeg',
      sizeBytes: VALID_SIZE_BYTES,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('WebP')
  })

  it('Zod 拒否: sizeBytes が上限超過', async () => {
    const result = await createUploadUrl({
      pageId: PAGE_ID,
      contentType: VALID_WEBP_CONTENT_TYPE,
      sizeBytes: OVER_SIZE_BYTES,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('5')
  })

  it('Zod 拒否: sizeBytes が 0（正の整数でない）', async () => {
    const result = await createUploadUrl({
      pageId: PAGE_ID,
      contentType: VALID_WEBP_CONTENT_TYPE,
      sizeBytes: 0,
    })

    expect(result.success).toBe(false)
  })

  it('容量超過: 使用量 + 今回サイズが上限を超える場合は拒否する', async () => {
    // 無料プラン（200MB）。フォルダリストとファイルリストで容量を返す
    mockClient._maybeSingle
      // getUserPlan
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
      // pages 所有確認
      .mockResolvedValueOnce({ data: { id: PAGE_ID }, error: null })

    // list(userId) → フォルダ一覧
    mockClient._storage._bucket.list
      .mockResolvedValueOnce({ data: [{ name: 'some-page-id' }], error: null })
      // list(userId/some-page-id) → ファイル一覧（199MB 分）
      .mockResolvedValueOnce({
        data: [{ name: 'img.webp', metadata: { size: 199 * 1024 * 1024 } }],
        error: null,
      })

    // 残り 1MB 未満に 2MB を入れようとする
    const result = await createUploadUrl({
      pageId: PAGE_ID,
      contentType: VALID_WEBP_CONTENT_TYPE,
      sizeBytes: 2 * 1024 * 1024,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('200MB')
  })

  it('他人のページ ID を指定しても拒否される（page 存在確認）', async () => {
    // getUserPlan は free（容量チェック通過のため空リスト）
    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
      // pages 所有確認: 存在しない（他人のページ）
      .mockResolvedValueOnce({ data: null, error: null })

    const result = await createUploadUrl({
      pageId: PAGE_ID,
      contentType: VALID_WEBP_CONTENT_TYPE,
      sizeBytes: VALID_SIZE_BYTES,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('見つかりません')
  })

  it('Storage の createSignedUploadUrl がエラーを返したら ERR_DB', async () => {
    mockClient._maybeSingle
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
      .mockResolvedValueOnce({ data: { id: PAGE_ID }, error: null })

    mockClient._storage._bucket.createSignedUploadUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'storage error' },
    })

    const result = await createUploadUrl({
      pageId: PAGE_ID,
      contentType: VALID_WEBP_CONTENT_TYPE,
      sizeBytes: VALID_SIZE_BYTES,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('読み書き')
  })

  it('引数に apiKey に類するフィールドが存在しないことを型で担保', () => {
    // @ts-expect-error apiKey は createUploadUrl の引数に存在しない
    void createUploadUrl({ pageId: PAGE_ID, contentType: 'image/webp', sizeBytes: 100, apiKey: 'sk-test' })
  })
})

// =====================
// deleteImage
// =====================
describe('deleteImage', () => {
  it('正常系: 自分の画像を削除できる', async () => {
    const path = `${USER_ID}/${PAGE_ID}/uuid.webp`
    const result = await deleteImage({ path })

    expect(result.success).toBe(true)
    expect(mockClient._storage._bucket.remove).toHaveBeenCalledWith([path])
  })

  it('未認証は error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await deleteImage({ path: `${USER_ID}/${PAGE_ID}/uuid.webp` })

    expect(result.success).toBe(false)
  })

  it('Zod 拒否: path が空文字列', async () => {
    const result = await deleteImage({ path: '' })

    expect(result.success).toBe(false)
  })

  it('他人の userId を持つパスは拒否される', async () => {
    const otherUserId = 'c0000099-0000-4000-8000-000000000099'
    const result = await deleteImage({ path: `${otherUserId}/${PAGE_ID}/uuid.webp` })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('削除できません')
  })

  it('自分の userId に一致しないパス（先頭セグメント不一致）は拒否される', async () => {
    const result = await deleteImage({ path: `other-user/${PAGE_ID}/uuid.webp` })

    expect(result.success).toBe(false)
  })

  it('Storage の remove がエラーを返したら ERR_DB', async () => {
    mockClient._storage._bucket.remove.mockResolvedValueOnce({
      data: null,
      error: { message: 'remove error' },
    })

    const result = await deleteImage({ path: `${USER_ID}/${PAGE_ID}/uuid.webp` })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('読み書き')
  })

  it('引数に apiKey に類するフィールドが存在しないことを型で担保', () => {
    // @ts-expect-error apiKey は deleteImage の引数に存在しない
    void deleteImage({ path: `${USER_ID}/${PAGE_ID}/uuid.webp`, apiKey: 'sk-test' })
  })
})
