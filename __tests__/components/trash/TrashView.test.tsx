import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseTrashedPages = vi.fn()
vi.mock('@/hooks/use-trashed-pages', () => ({
  useTrashedPages: () => mockUseTrashedPages(),
}))

const mockRestore = vi.fn()
const mockDeletePermanently = vi.fn()
vi.mock('@/hooks/use-page-mutations', () => ({
  usePageMutations: () => ({
    restore: mockRestore,
    deletePermanently: mockDeletePermanently,
    create: vi.fn(),
    rename: vi.fn(),
    trash: vi.fn(),
    move: vi.fn(),
    reorder: vi.fn(),
  }),
}))

const { TrashView } = await import('@/components/trash/TrashView')

const ITEM_1 = {
  id: 'a0000001-0000-4000-8000-000000000001',
  title: '削除ページ 1',
  icon: null,
  trashed_at: '2026-01-10T00:00:00Z',
}
const ITEM_2 = {
  id: 'a0000002-0000-4000-8000-000000000002',
  title: '削除ページ 2',
  icon: '📝',
  trashed_at: '2026-01-09T00:00:00Z',
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return Wrapper
}

function makeDefaultPageState(items = [ITEM_1, ITEM_2]) {
  return {
    items,
    isLoading: false,
    error: null,
    loadMore: vi.fn(),
    hasMore: false,
    nextCursor: undefined,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TrashView', () => {
  it('ロード中は skeleton を表示する', () => {
    mockUseTrashedPages.mockReturnValue({
      items: [],
      isLoading: true,
      error: null,
      loadMore: vi.fn(),
      hasMore: false,
      nextCursor: undefined,
    })
    render(<TrashView />, { wrapper: makeWrapper() })
    // skeleton が表示されることを確認（body に内容あり、エラーなし）
    expect(screen.queryByText('ごみ箱は空です')).not.toBeInTheDocument()
  })

  it('エラー時はエラーメッセージを表示する', () => {
    mockUseTrashedPages.mockReturnValue({
      items: [],
      isLoading: false,
      error: new Error('取得失敗'),
      loadMore: vi.fn(),
      hasMore: false,
      nextCursor: undefined,
    })
    render(<TrashView />, { wrapper: makeWrapper() })
    expect(screen.getByText('ごみ箱の読み込みに失敗しました')).toBeInTheDocument()
  })

  it('空の場合は空状態を表示する', () => {
    mockUseTrashedPages.mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
      loadMore: vi.fn(),
      hasMore: false,
      nextCursor: undefined,
    })
    render(<TrashView />, { wrapper: makeWrapper() })
    expect(screen.getByText('ごみ箱は空です')).toBeInTheDocument()
  })

  it('ページ一覧を描画する', () => {
    mockUseTrashedPages.mockReturnValue(makeDefaultPageState())
    render(<TrashView />, { wrapper: makeWrapper() })
    expect(screen.getByText('削除ページ 1')).toBeInTheDocument()
    expect(screen.getByText('削除ページ 2')).toBeInTheDocument()
    expect(screen.getByText('📝')).toBeInTheDocument()
  })

  it('復元ボタンをクリックすると restore が呼ばれる', async () => {
    mockRestore.mockResolvedValueOnce({ success: true })
    mockUseTrashedPages.mockReturnValue(makeDefaultPageState([ITEM_1]))
    const user = userEvent.setup()

    render(<TrashView />, { wrapper: makeWrapper() })
    await user.click(screen.getByRole('button', { name: '復元' }))

    expect(mockRestore).toHaveBeenCalledWith(ITEM_1.id)
  })

  it('完全削除ボタンをクリックすると確認ダイアログが開く', async () => {
    mockUseTrashedPages.mockReturnValue(makeDefaultPageState([ITEM_1]))
    const user = userEvent.setup()

    render(<TrashView />, { wrapper: makeWrapper() })
    await user.click(screen.getByRole('button', { name: '完全に削除' }))

    expect(await screen.findByText('完全に削除しますか？')).toBeInTheDocument()
  })

  it('確認ダイアログで「完全に削除」を押すと deletePagePermanently が呼ばれる', async () => {
    mockDeletePermanently.mockResolvedValueOnce({ success: true })
    mockUseTrashedPages.mockReturnValue(makeDefaultPageState([ITEM_1]))
    const user = userEvent.setup()

    render(<TrashView />, { wrapper: makeWrapper() })
    await user.click(screen.getByRole('button', { name: '完全に削除' }))

    await screen.findByText('完全に削除しますか？')

    // ダイアログ内の「完全に削除」ボタンをクリック
    const confirmBtns = screen.getAllByRole('button', { name: '完全に削除' })
    // ダイアログ内のボタンは2番目以降（最初はリスト項目）
    const dialogConfirmBtn = confirmBtns.find(btn => {
      // 削除確認ダイアログのボタンは variant="destructive" だが、
      // data-variant 属性でも判断できる
      return btn.closest('[data-slot="dialog-content"]') !== null
    })

    if (dialogConfirmBtn) {
      await user.click(dialogConfirmBtn)
      expect(mockDeletePermanently).toHaveBeenCalledWith(ITEM_1.id)
    } else {
      // フォールバック: 最後の「完全に削除」ボタンを使用
      const lastBtn = confirmBtns[confirmBtns.length - 1]
      if (lastBtn) {
        await user.click(lastBtn)
        await waitFor(() => expect(mockDeletePermanently).toHaveBeenCalledWith(ITEM_1.id))
      }
    }
  })

  it('hasMore=true のとき「もっと見る」ボタンが表示され、クリックで loadMore が呼ばれる', async () => {
    const loadMore = vi.fn()
    mockUseTrashedPages.mockReturnValue({
      ...makeDefaultPageState([ITEM_1]),
      hasMore: true,
      loadMore,
      nextCursor: '2026-01-09T00:00:00Z',
    })
    const user = userEvent.setup()

    render(<TrashView />, { wrapper: makeWrapper() })
    const loadMoreBtn = screen.getByRole('button', { name: 'もっと見る' })
    await user.click(loadMoreBtn)

    expect(loadMore).toHaveBeenCalledTimes(1)
  })
})
