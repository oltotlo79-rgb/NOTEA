import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PageError } from '@/components/common/PageError'

describe('PageError', () => {
  it('デフォルトタイトルとエラーメッセージを表示する', () => {
    render(<PageError error={new Error('テストエラー')} reset={vi.fn()} />)
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    expect(screen.getByText('テストエラー')).toBeInTheDocument()
  })

  it('カスタムタイトルを表示する', () => {
    render(<PageError error={new Error('何か')} reset={vi.fn()} title="読み込みに失敗しました" />)
    expect(screen.getByText('読み込みに失敗しました')).toBeInTheDocument()
  })

  it('再試行ボタンをクリックすると reset が呼ばれる', async () => {
    const reset = vi.fn()
    const user = userEvent.setup()
    render(<PageError error={new Error('エラー')} reset={reset} />)
    await user.click(screen.getByRole('button', { name: '再試行' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
