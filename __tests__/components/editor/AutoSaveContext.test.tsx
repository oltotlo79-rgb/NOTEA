/**
 * @module __tests__/components/editor/AutoSaveContext.test.tsx
 * AutoSaveContext の Provider と useAutoSaveContext フックのユニットテスト。
 */
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AutoSaveProvider, useAutoSaveContext } from '@/components/editor/AutoSaveContext'

// テスト用の Consumer コンポーネント
function TestConsumer() {
  const ctx = useAutoSaveContext()
  if (!ctx) return <div data-testid="no-ctx">no ctx</div>
  return (
    <div>
      <span data-testid="status">{ctx.status}</span>
      <button data-testid="set-saving" onClick={() => ctx.setStatus('saving')}>saving</button>
      <button data-testid="set-saved" onClick={() => ctx.setStatus('saved')}>saved</button>
      <button data-testid="set-error" onClick={() => ctx.setStatus('error')}>error</button>
      <button data-testid="retry" onClick={() => ctx.onRetry()}>retry</button>
      <button
        data-testid="register-retry"
        onClick={() => ctx.setOnRetry(() => { document.title = 'retried' })}
      >
        register
      </button>
    </div>
  )
}

describe('AutoSaveContext', () => {
  // =====================
  // Provider なし
  // =====================
  describe('Provider なし', () => {
    it('Provider なしで useAutoSaveContext は null を返す', () => {
      render(<TestConsumer />)
      expect(screen.getByTestId('no-ctx')).toBeInTheDocument()
    })
  })

  // =====================
  // Provider あり
  // =====================
  describe('Provider あり', () => {
    it('初期 status は idle', () => {
      render(
        <AutoSaveProvider>
          <TestConsumer />
        </AutoSaveProvider>
      )
      expect(screen.getByTestId('status')).toHaveTextContent('idle')
    })

    it('setStatus("saving") で status が saving になる', async () => {
      const user = userEvent.setup()
      render(
        <AutoSaveProvider>
          <TestConsumer />
        </AutoSaveProvider>
      )
      await user.click(screen.getByTestId('set-saving'))
      expect(screen.getByTestId('status')).toHaveTextContent('saving')
    })

    it('setStatus("saved") で status が saved になる', async () => {
      const user = userEvent.setup()
      render(
        <AutoSaveProvider>
          <TestConsumer />
        </AutoSaveProvider>
      )
      await user.click(screen.getByTestId('set-saved'))
      expect(screen.getByTestId('status')).toHaveTextContent('saved')
    })

    it('setStatus("error") で status が error になる', async () => {
      const user = userEvent.setup()
      render(
        <AutoSaveProvider>
          <TestConsumer />
        </AutoSaveProvider>
      )
      await user.click(screen.getByTestId('set-error'))
      expect(screen.getByTestId('status')).toHaveTextContent('error')
    })

    it('setOnRetry で登録した関数が onRetry 呼び出しで実行される', async () => {
      const user = userEvent.setup()
      render(
        <AutoSaveProvider>
          <TestConsumer />
        </AutoSaveProvider>
      )
      // 再試行関数を登録
      await user.click(screen.getByTestId('register-retry'))
      // 再試行を呼ぶ（document.title を変更する関数を登録した）
      act(() => {
        screen.getByTestId('retry').click()
      })
      expect(document.title).toBe('retried')
    })

    it('onRetry が登録されていない場合は呼んでもエラーにならない', async () => {
      const user = userEvent.setup()
      render(
        <AutoSaveProvider>
          <TestConsumer />
        </AutoSaveProvider>
      )
      // setOnRetry を呼ばずに onRetry を呼ぶ
      await expect(user.click(screen.getByTestId('retry'))).resolves.not.toThrow()
    })
  })

  // =====================
  // 複数 Consumer
  // =====================
  describe('複数 Consumer', () => {
    function OtherConsumer() {
      const ctx = useAutoSaveContext()
      if (!ctx) return null
      return <span data-testid="other-status">{ctx.status}</span>
    }

    it('同じ Provider 内の複数 Consumer は同じ状態を共有する', async () => {
      const user = userEvent.setup()
      render(
        <AutoSaveProvider>
          <TestConsumer />
          <OtherConsumer />
        </AutoSaveProvider>
      )

      await user.click(screen.getByTestId('set-saving'))
      expect(screen.getByTestId('status')).toHaveTextContent('saving')
      expect(screen.getByTestId('other-status')).toHaveTextContent('saving')
    })
  })
})
