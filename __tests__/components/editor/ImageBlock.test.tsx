/**
 * @module __tests__/components/editor/ImageBlock.test.tsx
 * ImageBlock (ImageBlockView) コンポーネントのユニットテスト。
 * useImageUrl をモックして url解決・エラー・ローディング状態を検証する。
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockUseImageUrl = vi.fn()

vi.mock('@/hooks/use-image-url', () => ({
  useImageUrl: (...args: unknown[]) => mockUseImageUrl(...args),
}))

// ImageUploadPlaceholder は実際のものを使う（テスト済みのコンポーネント）
const { ImageBlockView } = await import('@/components/editor/ImageBlock')

const DELETE_FN = vi.fn()
const DEFAULT_PROPS = {
  src: 'user-1/page-1/image.webp',
  caption: '',
  onDelete: DELETE_FN,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ImageBlockView', () => {
  // =====================
  // ローディング中（url=null, error=false）
  // =====================
  describe('ローディング中', () => {
    it('url が null のときアップロードプレースホルダーを表示する', () => {
      mockUseImageUrl.mockReturnValueOnce({ url: null, error: false })
      render(<ImageBlockView {...DEFAULT_PROPS} />)
      expect(screen.getByTestId('image-upload-placeholder')).toBeInTheDocument()
    })

    it('url が null のとき「画像をアップロード中…」テキストを表示する', () => {
      mockUseImageUrl.mockReturnValueOnce({ url: null, error: false })
      render(<ImageBlockView {...DEFAULT_PROPS} />)
      expect(screen.getByText('画像をアップロード中…')).toBeInTheDocument()
    })

    it('url が null のとき img タグは表示されない', () => {
      mockUseImageUrl.mockReturnValueOnce({ url: null, error: false })
      render(<ImageBlockView {...DEFAULT_PROPS} />)
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })

  // =====================
  // エラー時（error=true）
  // =====================
  describe('エラー時', () => {
    it('error=true のときエラープレースホルダーを表示する', () => {
      mockUseImageUrl.mockReturnValueOnce({ url: null, error: true })
      render(<ImageBlockView {...DEFAULT_PROPS} />)
      expect(screen.getByTestId('image-upload-error')).toBeInTheDocument()
    })

    it('エラーメッセージ「画像を読み込めませんでした」を表示する', () => {
      mockUseImageUrl.mockReturnValueOnce({ url: null, error: true })
      render(<ImageBlockView {...DEFAULT_PROPS} />)
      expect(screen.getByText('画像を読み込めませんでした')).toBeInTheDocument()
    })

    it('削除ボタンをクリックすると onDelete が呼ばれる', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      mockUseImageUrl.mockReturnValueOnce({ url: null, error: true })
      render(<ImageBlockView {...DEFAULT_PROPS} onDelete={onDelete} />)
      await user.click(screen.getByTestId('image-delete'))
      expect(onDelete).toHaveBeenCalledOnce()
    })

    it('error=true のとき img タグは表示されない', () => {
      mockUseImageUrl.mockReturnValueOnce({ url: null, error: true })
      render(<ImageBlockView {...DEFAULT_PROPS} />)
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
  })

  // =====================
  // 画像表示（url が解決済み）
  // =====================
  describe('画像表示', () => {
    it('url が解決されると img タグを表示する', () => {
      const signedUrl = 'https://supabase.example.com/signed/image.webp'
      mockUseImageUrl.mockReturnValueOnce({ url: signedUrl, error: false })
      render(<ImageBlockView {...DEFAULT_PROPS} />)
      const img = screen.getByRole('img')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', signedUrl)
    })

    it('キャプションがある場合は figcaption を表示する', () => {
      const signedUrl = 'https://supabase.example.com/signed/image.webp'
      mockUseImageUrl.mockReturnValueOnce({ url: signedUrl, error: false })
      render(<ImageBlockView src={DEFAULT_PROPS.src} caption="これはキャプションです" onDelete={DELETE_FN} />)
      expect(screen.getByText('これはキャプションです')).toBeInTheDocument()
    })

    it('キャプションが空文字のとき figcaption を表示しない', () => {
      const signedUrl = 'https://supabase.example.com/signed/image.webp'
      mockUseImageUrl.mockReturnValueOnce({ url: signedUrl, error: false })
      render(<ImageBlockView {...DEFAULT_PROPS} caption="" />)
      expect(screen.queryByRole('figure')).not.toHaveTextContent('figcaption')
    })

    it('alt 属性はキャプションが空のとき「画像」になる', () => {
      const signedUrl = 'https://supabase.example.com/signed/image.webp'
      mockUseImageUrl.mockReturnValueOnce({ url: signedUrl, error: false })
      render(<ImageBlockView {...DEFAULT_PROPS} caption="" />)
      expect(screen.getByRole('img')).toHaveAttribute('alt', '画像')
    })

    it('alt 属性はキャプションがある場合はキャプションになる', () => {
      const signedUrl = 'https://supabase.example.com/signed/image.webp'
      mockUseImageUrl.mockReturnValueOnce({ url: signedUrl, error: false })
      render(<ImageBlockView src={DEFAULT_PROPS.src} caption="山の写真" onDelete={DELETE_FN} />)
      expect(screen.getByRole('img')).toHaveAttribute('alt', '山の写真')
    })

    it('useImageUrl に src が渡される', () => {
      mockUseImageUrl.mockReturnValueOnce({ url: 'https://example.com/img.webp', error: false })
      render(<ImageBlockView src="user-1/page-1/test.webp" caption="" onDelete={DELETE_FN} />)
      expect(mockUseImageUrl).toHaveBeenCalledWith('user-1/page-1/test.webp')
    })

    it('img は max-w-full rounded-md クラスを持つ', () => {
      mockUseImageUrl.mockReturnValueOnce({ url: 'https://example.com/img.webp', error: false })
      render(<ImageBlockView {...DEFAULT_PROPS} />)
      const img = screen.getByRole('img')
      expect(img.className).toContain('max-w-full')
      expect(img.className).toContain('rounded-md')
    })
  })
})
