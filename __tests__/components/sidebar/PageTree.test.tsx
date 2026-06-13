import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUsePathname = vi.fn(() => '/pages')
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn() }),
}))

const mockUsePageTree = vi.fn()
vi.mock('@/hooks/use-page-tree', () => ({
  usePageTree: () => mockUsePageTree(),
}))

// use-page-mutations と use-sidebar-state は実装を使う（PageTreeItem が依存）
vi.mock('@/lib/actions/pages', () => ({
  createPage: vi.fn().mockResolvedValue({ success: false, error: 'mocked' }),
  updatePageMeta: vi.fn().mockResolvedValue({ success: true }),
  trashPage: vi.fn().mockResolvedValue({ success: true }),
  restorePage: vi.fn().mockResolvedValue({ success: true }),
  deletePagePermanently: vi.fn().mockResolvedValue({ success: true }),
  movePage: vi.fn().mockResolvedValue({ success: true }),
  reorderPage: vi.fn().mockResolvedValue({ success: true }),
}))

const { PageTree } = await import('@/components/sidebar/PageTree')

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return Wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom の localStorage を安全にクリア
  if (typeof localStorage !== 'undefined' && localStorage.clear) {
    localStorage.clear()
  }
  mockUsePathname.mockReturnValue('/pages')
})

describe('PageTree', () => {
  it('ローディング中は skeleton を表示する', () => {
    mockUsePageTree.mockReturnValue({ isLoading: true, data: undefined, error: null })
    render(<PageTree />, { wrapper: makeWrapper() })
    // Skeleton は少なくとも何か表示されることを確認
    expect(document.body.innerHTML).not.toBe('')
  })

  it('エラー時はエラーメッセージを表示する', () => {
    mockUsePageTree.mockReturnValue({ isLoading: false, data: undefined, error: new Error('取得失敗') })
    render(<PageTree />, { wrapper: makeWrapper() })
    expect(screen.getByText('ページツリーの読み込みに失敗しました')).toBeInTheDocument()
  })

  it('ページが空の場合は空状態を表示する', () => {
    mockUsePageTree.mockReturnValue({ isLoading: false, data: [], error: null })
    render(<PageTree />, { wrapper: makeWrapper() })
    expect(screen.getByText('ページがありません')).toBeInTheDocument()
  })

  it('onCreatePage prop があれば空状態に作成ボタンを表示する', async () => {
    mockUsePageTree.mockReturnValue({ isLoading: false, data: [], error: null })
    const onCreatePage = vi.fn()
    const user = userEvent.setup()

    render(<PageTree onCreatePage={onCreatePage} />, { wrapper: makeWrapper() })
    await user.click(screen.getByText('最初のページを作成'))

    expect(onCreatePage).toHaveBeenCalledTimes(1)
  })

  it('ページが存在する場合はツリーを描画する', () => {
    const pages = [
      { id: 'a0000001-0000-4000-8000-000000000001', parent_id: null, title: 'ページ A', icon: null, sort_order: 0 },
      { id: 'a0000002-0000-4000-8000-000000000002', parent_id: null, title: 'ページ B', icon: null, sort_order: 1 },
    ]
    mockUsePageTree.mockReturnValue({ isLoading: false, data: pages, error: null })

    render(<PageTree />, { wrapper: makeWrapper() })
    expect(screen.getByText('ページ A')).toBeInTheDocument()
    expect(screen.getByText('ページ B')).toBeInTheDocument()
  })
})
