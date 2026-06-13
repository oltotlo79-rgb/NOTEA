import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const updatePageMeta = vi.fn()
vi.mock('@/lib/actions/pages', () => ({
  updatePageMeta: (...args: unknown[]) => updatePageMeta(...args),
}))

const { PageHeader } = await import('@/components/page/PageHeader')

const PAGE_ID = 'a0000001-0000-4000-8000-000000000001'

function renderWithQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client: queryClient }, ui))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageHeader', () => {
  it('タイトル input を描画する', () => {
    renderWithQuery(<PageHeader pageId={PAGE_ID} title="初期タイトル" icon={null} />)
    const input = screen.getByDisplayValue('初期タイトル')
    expect(input).toBeInTheDocument()
  })

  it('blur 時にタイトルが変更されていれば updatePageMeta を呼ぶ', async () => {
    updatePageMeta.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    renderWithQuery(<PageHeader pageId={PAGE_ID} title="元のタイトル" icon={null} />)

    const input = screen.getByDisplayValue('元のタイトル')
    await user.tripleClick(input)
    await user.type(input, '新しいタイトル')
    await user.tab()

    expect(updatePageMeta).toHaveBeenCalledWith({ id: PAGE_ID, title: expect.stringContaining('新しいタイトル') })
  })

  it('blur 時にタイトルが変わっていなければ updatePageMeta を呼ばない', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PageHeader pageId={PAGE_ID} title="変わらないタイトル" icon={null} />)

    const input = screen.getByDisplayValue('変わらないタイトル')
    await user.click(input)
    await user.tab()

    expect(updatePageMeta).not.toHaveBeenCalled()
  })

  it('Enter キーで blur が発生して updatePageMeta を呼ぶ', async () => {
    updatePageMeta.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    renderWithQuery(<PageHeader pageId={PAGE_ID} title="古い" icon={null} />)

    const input = screen.getByDisplayValue('古い')
    await user.tripleClick(input)
    await user.type(input, '新しい{Enter}')

    expect(updatePageMeta).toHaveBeenCalled()
  })

  it('アイコンボタンをクリックするとアイコン入力欄が表示される', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PageHeader pageId={PAGE_ID} title="タイトル" icon="📝" />)

    await user.click(screen.getByRole('button', { name: 'アイコンを変更' }))
    expect(screen.getByPlaceholderText('絵文字を入力')).toBeInTheDocument()
  })

  it('アイコン変更を blur で確定すると updatePageMeta({ id, icon }) を呼ぶ', async () => {
    updatePageMeta.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    renderWithQuery(<PageHeader pageId={PAGE_ID} title="タイトル" icon="📄" />)

    await user.click(screen.getByRole('button', { name: 'アイコンを変更' }))
    const iconInput = screen.getByPlaceholderText('絵文字を入力')
    await user.tripleClick(iconInput)
    await user.type(iconInput, '🌟')
    await user.tab()

    expect(updatePageMeta).toHaveBeenCalledWith(
      expect.objectContaining({ id: PAGE_ID, icon: expect.stringContaining('🌟') })
    )
  })

  it('アイコン入力で Escape を押すと元に戻る', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PageHeader pageId={PAGE_ID} title="タイトル" icon="📄" />)

    await user.click(screen.getByRole('button', { name: 'アイコンを変更' }))
    const iconInput = screen.getByPlaceholderText('絵文字を入力')
    await user.type(iconInput, '🌟')
    await user.keyboard('{Escape}')

    expect(screen.queryByPlaceholderText('絵文字を入力')).not.toBeInTheDocument()
    expect(updatePageMeta).not.toHaveBeenCalled()
  })
})
