import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const createPage = vi.fn()
vi.mock('@/lib/actions/pages', () => ({
  createPage: (...args: unknown[]) => createPage(...args),
}))

const { CreateFirstPageButton } = await import('@/components/page/CreateFirstPageButton')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CreateFirstPageButton', () => {
  it('ボタンを描画する', () => {
    render(<CreateFirstPageButton />)
    expect(screen.getByRole('button', { name: '最初のページを作成' })).toBeInTheDocument()
  })

  it('クリックで createPage({}) を呼び、成功時に /pages/[id] へ遷移する', async () => {
    const newId = 'b0000001-0000-4000-8000-000000000001'
    createPage.mockResolvedValueOnce({ success: true, data: { id: newId } })
    const user = userEvent.setup()

    render(<CreateFirstPageButton />)
    await user.click(screen.getByRole('button', { name: '最初のページを作成' }))

    expect(createPage).toHaveBeenCalledWith({})
    expect(push).toHaveBeenCalledWith(`/pages/${newId}`)
  })

  it('createPage が失敗してもクラッシュせず遷移しない', async () => {
    createPage.mockResolvedValueOnce({ success: false, error: 'エラー' })
    const user = userEvent.setup()

    render(<CreateFirstPageButton />)
    await user.click(screen.getByRole('button', { name: '最初のページを作成' }))

    expect(push).not.toHaveBeenCalled()
  })
})
