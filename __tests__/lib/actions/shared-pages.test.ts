import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient
let mockAdmin: MockSupabaseClient

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockAdmin,
}))

const { getSharedPage, updateSharedPageContent, getSharedImageUrl } = await import(
  '@/lib/actions/shared-pages'
)

const TOKEN = 'abcdefghijklmnop1234'
const OWNER = 'a0000099-0000-4000-8000-000000000099'

const SHARED_ROW = {
  id: 'a0000001-0000-4000-8000-000000000001',
  title: '共有ページ',
  icon: '📄',
  content: [{ type: 'paragraph' }],
  content_text: '本文テキスト',
  updated_at: '2026-06-17T00:00:00.000Z',
  permission: 'view',
}

beforeEach(() => {
  mockClient = createMockSupabaseClient()
  mockAdmin = createMockSupabaseClient()
})

describe('getSharedPage', () => {
  it('無効な形式のトークンは null（DB に問い合わせない）', async () => {
    const result = await getSharedPage('short')
    expect(result.data).toBeNull()
    expect(mockClient.rpc).not.toHaveBeenCalled()
  })

  it('一致する共有ページを返す', async () => {
    mockClient._rpc.mockResolvedValueOnce({ data: [SHARED_ROW], error: null })
    const result = await getSharedPage(TOKEN)
    expect(result.error).toBeUndefined()
    expect(result.data).toMatchObject({
      id: SHARED_ROW.id,
      title: '共有ページ',
      contentText: '本文テキスト',
      permission: 'view',
    })
  })

  it('該当なし（空配列）は null', async () => {
    mockClient._rpc.mockResolvedValueOnce({ data: [], error: null })
    const result = await getSharedPage(TOKEN)
    expect(result.data).toBeNull()
    expect(result.error).toBeUndefined()
  })

  it('RPC は get_shared_page を p_token で呼ぶ', async () => {
    mockClient._rpc.mockResolvedValueOnce({ data: [SHARED_ROW], error: null })
    await getSharedPage(TOKEN)
    expect(mockClient.rpc).toHaveBeenCalledWith('get_shared_page', { p_token: TOKEN })
  })

  it('DB エラー時は null + error', async () => {
    mockClient._rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const result = await getSharedPage(TOKEN)
    expect(result.data).toBeNull()
    expect(result.error).toBeTruthy()
  })
})

describe('updateSharedPageContent', () => {
  it('未ログインは拒否（編集はログイン必須）', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await updateSharedPageContent({ token: TOKEN, content: [], contentText: '' })
    expect(result).toMatchObject({ success: false })
    expect(mockClient.rpc).not.toHaveBeenCalled()
  })

  it('不正トークンは Zod で拒否', async () => {
    const result = await updateSharedPageContent({ token: 'bad', content: [], contentText: '' })
    expect(result).toMatchObject({ success: false })
  })

  it('正常時は update_shared_page を呼ぶ', async () => {
    mockClient._rpc.mockResolvedValueOnce({ data: null, error: null })
    const result = await updateSharedPageContent({
      token: TOKEN,
      content: [{ type: 'paragraph' }],
      contentText: 'x',
    })
    expect(result).toMatchObject({ success: true })
    expect(mockClient.rpc).toHaveBeenCalledWith(
      'update_shared_page',
      expect.objectContaining({ p_token: TOKEN, p_content_text: 'x' })
    )
  })

  it('RPC エラー（view トークン等で関数が例外）はエラー', async () => {
    mockClient._rpc.mockResolvedValueOnce({ data: null, error: { message: 'SHARE_NOT_FOUND' } })
    const result = await updateSharedPageContent({
      token: TOKEN,
      content: [{ type: 'paragraph' }],
      contentText: 'x',
    })
    expect(result).toMatchObject({ success: false })
  })
})

describe('getSharedImageUrl', () => {
  it('不正入力は null + error', async () => {
    const result = await getSharedImageUrl({ token: 'bad', path: '' })
    expect(result.url).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('トークンが存在しなければ null + error', async () => {
    mockAdmin._maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await getSharedImageUrl({ token: TOKEN, path: `${OWNER}/page/img.webp` })
    expect(result.url).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('path が所有者プレフィックス外なら拒否（他人の画像を引かせない）', async () => {
    mockAdmin._maybeSingle.mockResolvedValueOnce({ data: { user_id: OWNER }, error: null })
    const result = await getSharedImageUrl({
      token: TOKEN,
      path: 'a0000000-0000-4000-8000-000000000000/page/img.webp',
    })
    expect(result.url).toBeNull()
    expect(result.error).toBeTruthy()
    // 署名 URL の生成に到達しない
    expect(mockAdmin._storage._bucket.createSignedUrl).not.toHaveBeenCalled()
  })

  it('所有者プレフィックス配下なら署名 URL を返す', async () => {
    mockAdmin._maybeSingle.mockResolvedValueOnce({ data: { user_id: OWNER }, error: null })
    const result = await getSharedImageUrl({ token: TOKEN, path: `${OWNER}/page/img.webp` })
    expect(result.error).toBeUndefined()
    expect(result.url).toBe('https://example.com/signed-view')
  })
})
