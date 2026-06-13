/**
 * @module __tests__/components/editor/ImageUploadPlaceholder.test.tsx
 * ImageUploadPlaceholder コンポーネントのユニットテスト。
 * uploading / error の2モードの表示・ボタン動作・aria を検証する。
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImageUploadPlaceholder } from '@/components/editor/ImageUploadPlaceholder'

describe('ImageUploadPlaceholder', () => {
  // =====================
  // uploading モード
  // =====================
  describe('uploading モード', () => {
    it('data-testid="image-upload-placeholder" が存在する', () => {
      render(<ImageUploadPlaceholder kind="uploading" />)
      expect(screen.getByTestId('image-upload-placeholder')).toBeInTheDocument()
    })

    it('「画像をアップロード中…」テキストを表示する', () => {
      render(<ImageUploadPlaceholder kind="uploading" />)
      expect(screen.getByText('画像をアップロード中…')).toBeInTheDocument()
    })

    it('aria-label="画像をアップロード中" が付与される', () => {
      render(<ImageUploadPlaceholder kind="uploading" />)
      expect(screen.getByLabelText('画像をアップロード中')).toBeInTheDocument()
    })

    it('progress=undefined のときはプログレスバーを表示しない', () => {
      render(<ImageUploadPlaceholder kind="uploading" />)
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('progress=60 のときはプログレスバーを表示する', () => {
      render(<ImageUploadPlaceholder kind="uploading" progress={60} />)
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toBeInTheDocument()
      expect(progressbar).toHaveAttribute('aria-valuenow', '60')
    })

    it('progress=0 のときはプログレスバーが 0% を示す', () => {
      render(<ImageUploadPlaceholder kind="uploading" progress={0} />)
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '0')
    })

    it('progress=100 のときはプログレスバーが 100% を示す', () => {
      render(<ImageUploadPlaceholder kind="uploading" progress={100} />)
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '100')
    })

    it('error モードの要素（image-upload-error）は表示されない', () => {
      render(<ImageUploadPlaceholder kind="uploading" />)
      expect(screen.queryByTestId('image-upload-error')).not.toBeInTheDocument()
    })
  })

  // =====================
  // error モード
  // =====================
  describe('error モード', () => {
    const defaultErrorProps = {
      kind: 'error' as const,
      message: 'アップロードに失敗しました',
      onRetry: vi.fn(),
      onDelete: vi.fn(),
    }

    it('data-testid="image-upload-error" が存在する', () => {
      render(<ImageUploadPlaceholder {...defaultErrorProps} />)
      expect(screen.getByTestId('image-upload-error')).toBeInTheDocument()
    })

    it('エラーメッセージが表示される', () => {
      render(<ImageUploadPlaceholder {...defaultErrorProps} />)
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })

    it('role="alert" が付与される', () => {
      render(<ImageUploadPlaceholder {...defaultErrorProps} />)
      const el = screen.getByTestId('image-upload-error')
      expect(el).toHaveAttribute('role', 'alert')
    })

    it('aria-live="assertive" が付与される', () => {
      render(<ImageUploadPlaceholder {...defaultErrorProps} />)
      const el = screen.getByTestId('image-upload-error')
      expect(el).toHaveAttribute('aria-live', 'assertive')
    })

    it('data-testid="image-retry" ボタンが存在する', () => {
      render(<ImageUploadPlaceholder {...defaultErrorProps} />)
      expect(screen.getByTestId('image-retry')).toBeInTheDocument()
    })

    it('data-testid="image-delete" ボタンが存在する', () => {
      render(<ImageUploadPlaceholder {...defaultErrorProps} />)
      expect(screen.getByTestId('image-delete')).toBeInTheDocument()
    })

    it('再試行ボタンをクリックすると onRetry が呼ばれる', async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()
      render(<ImageUploadPlaceholder {...defaultErrorProps} onRetry={onRetry} />)
      await user.click(screen.getByTestId('image-retry'))
      expect(onRetry).toHaveBeenCalledOnce()
    })

    it('削除ボタンをクリックすると onDelete が呼ばれる', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      render(<ImageUploadPlaceholder {...defaultErrorProps} onDelete={onDelete} />)
      await user.click(screen.getByTestId('image-delete'))
      expect(onDelete).toHaveBeenCalledOnce()
    })

    it('uploading モードの要素（image-upload-placeholder）は表示されない', () => {
      render(<ImageUploadPlaceholder {...defaultErrorProps} />)
      expect(screen.queryByTestId('image-upload-placeholder')).not.toBeInTheDocument()
    })

    it('異なるエラーメッセージが正しく表示される', () => {
      render(
        <ImageUploadPlaceholder
          kind="error"
          message="ストレージの上限に達しました"
          onRetry={vi.fn()}
          onDelete={vi.fn()}
        />
      )
      expect(screen.getByText('ストレージの上限に達しました')).toBeInTheDocument()
    })
  })
})
