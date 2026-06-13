/**
 * @module __tests__/components/editor/AutoSaveStatus.test.tsx
 * AutoSaveStatus コンポーネントのユニットテスト。
 * 状態別表示・aria 属性・再試行ボタンの動作を検証する。
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AutoSaveStatus } from '@/components/editor/AutoSaveStatus'

describe('AutoSaveStatus', () => {
  // =====================
  // idle: 非表示
  // =====================
  describe('idle 状態', () => {
    it('idle 状態では何も描画しない', () => {
      const { container } = render(<AutoSaveStatus status="idle" onRetry={vi.fn()} />)
      expect(container.firstChild).toBeNull()
    })
  })

  // =====================
  // saving: 保存中
  // =====================
  describe('saving 状態', () => {
    it('「保存中…」テキストを表示する', () => {
      render(<AutoSaveStatus status="saving" onRetry={vi.fn()} />)
      expect(screen.getByText('保存中…')).toBeInTheDocument()
    })

    it('data-testid="autosave-status" が存在する', () => {
      render(<AutoSaveStatus status="saving" onRetry={vi.fn()} />)
      expect(screen.getByTestId('autosave-status')).toBeInTheDocument()
    })

    it('role="status" と aria-live="polite" が付与される', () => {
      render(<AutoSaveStatus status="saving" onRetry={vi.fn()} />)
      const el = screen.getByTestId('autosave-status')
      expect(el).toHaveAttribute('role', 'status')
      expect(el).toHaveAttribute('aria-live', 'polite')
    })

    it('再試行ボタンは表示されない', () => {
      render(<AutoSaveStatus status="saving" onRetry={vi.fn()} />)
      expect(screen.queryByTestId('autosave-retry')).not.toBeInTheDocument()
    })
  })

  // =====================
  // saved: 保存済み
  // =====================
  describe('saved 状態', () => {
    it('「保存済み」テキストを表示する', () => {
      render(<AutoSaveStatus status="saved" onRetry={vi.fn()} />)
      expect(screen.getByText('保存済み')).toBeInTheDocument()
    })

    it('role="status" と aria-live="polite" が付与される', () => {
      render(<AutoSaveStatus status="saved" onRetry={vi.fn()} />)
      const el = screen.getByTestId('autosave-status')
      expect(el).toHaveAttribute('role', 'status')
      expect(el).toHaveAttribute('aria-live', 'polite')
    })

    it('再試行ボタンは表示されない', () => {
      render(<AutoSaveStatus status="saved" onRetry={vi.fn()} />)
      expect(screen.queryByTestId('autosave-retry')).not.toBeInTheDocument()
    })
  })

  // =====================
  // error: 保存失敗
  // =====================
  describe('error 状態', () => {
    it('「保存に失敗しました」テキストを表示する', () => {
      render(<AutoSaveStatus status="error" onRetry={vi.fn()} />)
      expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
    })

    it('data-testid="autosave-retry" ボタンを表示する', () => {
      render(<AutoSaveStatus status="error" onRetry={vi.fn()} />)
      expect(screen.getByTestId('autosave-retry')).toBeInTheDocument()
    })

    it('再試行ボタンのテキストは「再試行」', () => {
      render(<AutoSaveStatus status="error" onRetry={vi.fn()} />)
      expect(screen.getByTestId('autosave-retry')).toHaveTextContent('再試行')
    })

    it('再試行ボタンに aria-label="自動保存を再試行" が付与される', () => {
      render(<AutoSaveStatus status="error" onRetry={vi.fn()} />)
      const btn = screen.getByTestId('autosave-retry')
      expect(btn).toHaveAttribute('aria-label', '自動保存を再試行')
    })

    it('role="alert" と aria-live="assertive" が付与される（エラー優先）', () => {
      render(<AutoSaveStatus status="error" onRetry={vi.fn()} />)
      const el = screen.getByTestId('autosave-status')
      expect(el).toHaveAttribute('role', 'alert')
      expect(el).toHaveAttribute('aria-live', 'assertive')
    })

    it('再試行ボタンをクリックすると onRetry が呼ばれる', async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()
      render(<AutoSaveStatus status="error" onRetry={onRetry} />)
      await user.click(screen.getByTestId('autosave-retry'))
      expect(onRetry).toHaveBeenCalledOnce()
    })
  })
})
