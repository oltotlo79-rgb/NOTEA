import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const mockCreate = vi.fn()
const mockTrash = vi.fn()
vi.mock('@/hooks/use-page-mutations', () => ({
  usePageMutations: () => ({
    create: mockCreate,
    trash: mockTrash,
    rename: vi.fn(),
    restore: vi.fn(),
    deletePermanently: vi.fn(),
    move: vi.fn(),
    reorder: vi.fn(),
  }),
}))

const { PageItemMenu } = await import('@/components/sidebar/PageItemMenu')

const PAGE_ID = 'a0000001-0000-4000-8000-000000000001'
const NEW_PAGE_ID = 'b0000001-0000-4000-8000-000000000001'

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return Wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageItemMenu', () => {
  it('メニュートリガーボタンが存在する', () => {
    render(<PageItemMenu pageId={PAGE_ID} onRenameStart={vi.fn()} />, { wrapper: makeWrapper() })
    expect(screen.getByRole('button', { name: 'ページメニュー' })).toBeInTheDocument()
  })

  it('メニューを開いてサブページ追加をクリックすると create が呼ばれ遷移する', async () => {
    mockCreate.mockResolvedValueOnce({ success: true, data: { id: NEW_PAGE_ID } })
    const user = userEvent.setup()
    render(<PageItemMenu pageId={PAGE_ID} onRenameStart={vi.fn()} />, { wrapper: makeWrapper() })

    await user.click(screen.getByRole('button', { name: 'ページメニュー' }))
    const addBtn = await screen.findByText('サブページを追加')
    await user.click(addBtn)

    expect(mockCreate).toHaveBeenCalledWith({ parentId: PAGE_ID })
    expect(push).toHaveBeenCalledWith(`/pages/${NEW_PAGE_ID}`)
  })

  it('メニューを開いて名前変更をクリックすると onRenameStart が呼ばれる', async () => {
    const onRenameStart = vi.fn()
    const user = userEvent.setup()
    render(<PageItemMenu pageId={PAGE_ID} onRenameStart={onRenameStart} />, { wrapper: makeWrapper() })

    await user.click(screen.getByRole('button', { name: 'ページメニュー' }))
    const renameBtn = await screen.findByText('名前を変更')
    await user.click(renameBtn)

    expect(onRenameStart).toHaveBeenCalledTimes(1)
  })

  it('メニューを開いてごみ箱へ移動をクリックすると trash が呼ばれる', async () => {
    mockTrash.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    render(<PageItemMenu pageId={PAGE_ID} onRenameStart={vi.fn()} />, { wrapper: makeWrapper() })

    await user.click(screen.getByRole('button', { name: 'ページメニュー' }))
    const trashBtn = await screen.findByText('ごみ箱に移動')
    await user.click(trashBtn)

    expect(mockTrash).toHaveBeenCalledWith(PAGE_ID)
  })
})
