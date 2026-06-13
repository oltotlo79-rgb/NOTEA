/**
 * @module __tests__/components/editor/Editor.test.tsx
 * Editor.tsx の統合ロジックテスト。
 * BlockNote（@blocknote/react）は jsdom 未対応のため vi.mock でスタブし、
 * useCreateBlockNote に渡す uploadFile / resolveFileUrl / onChange の
 * 配線ロジックを直接取り出して検証する。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MAX_IMAGE_INPUT_SIZE_MB } from '@/lib/constants/limits'

// ---- BlockNote モック ----
// BlockNote のインスタンスとして受け取った options を後から参照できるよう
// キャプチャする。
type CapturedOptions = {
  uploadFile?: ((file: File) => Promise<string>) | undefined
  resolveFileUrl?: ((url: string) => Promise<string>) | undefined
  onChange?: (() => void) | undefined
}

const capturedOptions: CapturedOptions = {}

const mockEditorInstance = {
  document: [{ type: 'paragraph', content: [] }],
  blocksToMarkdownLossy: vi.fn(() => Promise.resolve('markdown text')),
}

vi.mock('@blocknote/react', () => {
  return {
    useCreateBlockNote: vi.fn((options: CapturedOptions) => {
      capturedOptions.uploadFile = options.uploadFile
      capturedOptions.resolveFileUrl = options.resolveFileUrl
      return mockEditorInstance
    }),
    BlockNoteViewRaw: vi.fn(({ onChange }: { onChange: () => void; children?: React.ReactNode }) => {
      capturedOptions.onChange = onChange
      return null
    }),
    SuggestionMenuController: vi.fn(() => null),
    getDefaultReactSlashMenuItems: vi.fn(() => []),
  }
})

vi.mock('@blocknote/core', () => ({}))

// ---- 依存モック ----
const mockCompressImage = vi.fn()
const mockCreateUploadUrl = vi.fn()
const mockCreateSignedUrl = vi.fn()
const mockFetch = vi.fn()

vi.mock('@/lib/images/compress', () => ({
  compressImage: (...args: unknown[]) => mockCompressImage(...args),
  isCompressError: (v: unknown): boolean =>
    typeof v === 'object' && v !== null && 'kind' in v && typeof (v as Record<string, unknown>)['kind'] === 'string',
}))

vi.mock('@/lib/actions/images', () => ({
  createUploadUrl: (...args: unknown[]) => mockCreateUploadUrl(...args),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}))

// SlashMenu モック
vi.mock('@/components/editor/SlashMenu', () => ({
  SlashMenu: vi.fn(() => null),
}))

// ---- テスト用インポート（モック後に import）----
import { render } from '@testing-library/react'

// Editor をインポートする（モック後なのでキャプチャが機能する）
const { Editor } = await import('@/components/editor/Editor')

// ---- ヘルパー ----
function makeJpegFile(sizeBytes = 100): File {
  const magic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
  const rest = new Uint8Array(Math.max(0, sizeBytes - magic.length))
  const buf = new Uint8Array(magic.length + rest.length)
  buf.set(magic, 0)
  buf.set(rest, magic.length)
  return new File([buf], 'test.jpg', { type: 'image/jpeg' })
}

const PAGE_ID = 'a0000001-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---- テスト ----

describe('Editor ロジック（BlockNote モック）', () => {
  // Editor を描画して capturedOptions を初期化する
  function renderEditor(onContentChange = vi.fn()) {
    render(
      <Editor
        pageId={PAGE_ID}
        initialContent={null}
        onContentChange={onContentChange}
      />
    )
  }

  // =====================
  // uploadFile ハンドラ
  // =====================
  describe('uploadFile ハンドラ', () => {
    it('compress → createUploadUrl → fetch PUT の順で処理が行われる', async () => {
      renderEditor()

      const compressedBlob = new Blob(['webp-data'], { type: 'image/webp' })
      mockCompressImage.mockResolvedValueOnce(compressedBlob)
      mockCreateUploadUrl.mockResolvedValueOnce({
        success: true,
        data: {
          signedUrl: 'https://storage.example.com/upload',
          path: `${PAGE_ID}/uuid.webp`,
        },
      })
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

      const file = makeJpegFile()
      const result = await capturedOptions.uploadFile!(file)

      expect(mockCompressImage).toHaveBeenCalledWith(file)
      expect(mockCreateUploadUrl).toHaveBeenCalledWith({
        pageId: PAGE_ID,
        contentType: 'image/webp',
        sizeBytes: compressedBlob.size,
      })
      expect(mockFetch).toHaveBeenCalledWith(
        'https://storage.example.com/upload',
        expect.objectContaining({
          method: 'PUT',
          body: compressedBlob,
          headers: { 'Content-Type': 'image/webp' },
        })
      )
      // 戻り値は署名URLではなく storage path
      expect(result).toBe(`${PAGE_ID}/uuid.webp`)
    })

    it('戻り値が署名URLではなく storage path であること（期限切れ回避）', async () => {
      renderEditor()

      const compressedBlob = new Blob(['webp-data'], { type: 'image/webp' })
      mockCompressImage.mockResolvedValueOnce(compressedBlob)
      mockCreateUploadUrl.mockResolvedValueOnce({
        success: true,
        data: {
          signedUrl: 'https://storage.example.com/upload?token=abc123',
          path: 'user-1/page-1/unique-uuid.webp',
        },
      })
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

      const result = await capturedOptions.uploadFile!(makeJpegFile())
      // 署名URLではなく path が返る
      expect(result).toBe('user-1/page-1/unique-uuid.webp')
      expect(result).not.toContain('token=abc123')
    })

    it('画像サイズ超過のとき compressImage は unsupported_type エラーを投げ、uploadFile も例外を投げる', async () => {
      renderEditor()

      const oversizeError = { kind: 'input_too_large', maxMb: MAX_IMAGE_INPUT_SIZE_MB }
      mockCompressImage.mockRejectedValueOnce(oversizeError)

      const file = makeJpegFile()
      await expect(capturedOptions.uploadFile!(file)).rejects.toThrow()
      expect(mockCreateUploadUrl).not.toHaveBeenCalled()
    })

    it('unsupported_type エラーのとき createUploadUrl は呼ばれない', async () => {
      renderEditor()

      const unsupportedError = { kind: 'unsupported_type' }
      mockCompressImage.mockRejectedValueOnce(unsupportedError)

      await expect(capturedOptions.uploadFile!(makeJpegFile())).rejects.toThrow()
      expect(mockCreateUploadUrl).not.toHaveBeenCalled()
    })

    it('createUploadUrl が失敗したとき例外を投げる', async () => {
      renderEditor()

      const compressedBlob = new Blob(['webp-data'], { type: 'image/webp' })
      mockCompressImage.mockResolvedValueOnce(compressedBlob)
      mockCreateUploadUrl.mockResolvedValueOnce({
        success: false,
        error: '容量超過',
      })

      await expect(capturedOptions.uploadFile!(makeJpegFile())).rejects.toThrow('容量超過')
    })

    it('createUploadUrl が success:true だが data が null のとき例外を投げる', async () => {
      renderEditor()

      const compressedBlob = new Blob(['webp-data'], { type: 'image/webp' })
      mockCompressImage.mockResolvedValueOnce(compressedBlob)
      mockCreateUploadUrl.mockResolvedValueOnce({
        success: true,
        data: null,
      })

      await expect(capturedOptions.uploadFile!(makeJpegFile())).rejects.toThrow()
    })

    it('PUT が 4xx を返したとき例外を投げる', async () => {
      renderEditor()

      const compressedBlob = new Blob(['webp-data'], { type: 'image/webp' })
      mockCompressImage.mockResolvedValueOnce(compressedBlob)
      mockCreateUploadUrl.mockResolvedValueOnce({
        success: true,
        data: {
          signedUrl: 'https://storage.example.com/upload',
          path: 'user-1/page-1/uuid.webp',
        },
      })
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })

      await expect(capturedOptions.uploadFile!(makeJpegFile())).rejects.toThrow()
    })

    it('createUploadUrl に apiKey フィールドが含まれないことを確認する（BYOK 保護）', async () => {
      renderEditor()

      const compressedBlob = new Blob(['webp-data'], { type: 'image/webp' })
      mockCompressImage.mockResolvedValueOnce(compressedBlob)
      mockCreateUploadUrl.mockResolvedValueOnce({
        success: true,
        data: {
          signedUrl: 'https://storage.example.com/upload',
          path: 'user-1/page-1/uuid.webp',
        },
      })
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

      await capturedOptions.uploadFile!(makeJpegFile())

      const callArg = mockCreateUploadUrl.mock.calls[0]?.[0] as Record<string, unknown>
      expect(callArg).not.toHaveProperty('apiKey')
      expect(callArg).not.toHaveProperty('api_key')
    })
  })

  // =====================
  // resolveFileUrl ハンドラ
  // =====================
  describe('resolveFileUrl ハンドラ', () => {
    it('http:// URL はそのまま返す（createSignedUrl を呼ばない）', async () => {
      renderEditor()

      const url = 'https://cdn.example.com/image.webp'
      const result = await capturedOptions.resolveFileUrl!(url)
      expect(result).toBe(url)
      expect(mockCreateSignedUrl).not.toHaveBeenCalled()
    })

    it('blob: URL はそのまま返す', async () => {
      renderEditor()

      const url = 'blob:https://example.com/1234'
      const result = await capturedOptions.resolveFileUrl!(url)
      expect(result).toBe(url)
    })

    it('data: URL はそのまま返す', async () => {
      renderEditor()

      const url = 'data:image/webp;base64,abc'
      const result = await capturedOptions.resolveFileUrl!(url)
      expect(result).toBe(url)
    })

    it('Storage path は createSignedUrl を呼び署名URLを返す', async () => {
      renderEditor()

      const signedUrl = 'https://supabase.example.com/signed/image.webp'
      mockCreateSignedUrl.mockResolvedValueOnce({ data: { signedUrl }, error: null })

      const result = await capturedOptions.resolveFileUrl!('user-1/page-1/image.webp')
      expect(result).toBe(signedUrl)
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('user-1/page-1/image.webp', 3600)
    })

    it('createSignedUrl が失敗したら path をそのまま返す（フォールバック）', async () => {
      renderEditor()

      mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'storage error' } })

      const path = 'user-1/page-1/image.webp'
      const result = await capturedOptions.resolveFileUrl!(path)
      expect(result).toBe(path)
    })
  })

  // =====================
  // onChange ハンドラ → onContentChange 配線
  // =====================
  describe('onChange → onContentChange 配線', () => {
    it('onChange が呼ばれると onContentChange が呼ばれる', () => {
      const onContentChange = vi.fn()
      renderEditor(onContentChange)

      capturedOptions.onChange!()

      expect(onContentChange).toHaveBeenCalledOnce()
    })

    it('onContentChange が editor.document を受け取る', () => {
      const onContentChange = vi.fn()
      renderEditor(onContentChange)

      capturedOptions.onChange!()

      const [contentArg] = onContentChange.mock.calls[0] as [unknown[], string]
      expect(contentArg).toEqual(mockEditorInstance.document)
    })
  })
})
