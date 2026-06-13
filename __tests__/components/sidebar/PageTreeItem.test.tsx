import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/pages',
}))

const mockRename = vi.fn()
const mockCreate = vi.fn()
const mockTrash = vi.fn()
vi.mock('@/hooks/use-page-mutations', () => ({
  usePageMutations: () => ({
    rename: mockRename,
    create: mockCreate,
    trash: mockTrash,
    restore: vi.fn().mockResolvedValue({ success: true }),
    deletePermanently: vi.fn().mockResolvedValue({ success: true }),
    move: vi.fn().mockResolvedValue({ success: true }),
    reorder: vi.fn().mockResolvedValue({ success: true }),
  }),
}))

const { PageTreeItem } = await import('@/components/sidebar/PageTreeItem')

const BASE_NODE = {
  id: 'a0000001-0000-4000-8000-000000000001',
  title: 'テストページ',
  icon: null,
  parent_id: null,
  sort_order: 0,
  children: [],
}

const CHILD_NODE = {
  id: 'a0000002-0000-4000-8000-000000000002',
  title: '子ページ',
  icon: null,
  parent_id: BASE_NODE.id,
  sort_order: 0,
  children: [],
}

const NODE_WITH_CHILDREN = {
  ...BASE_NODE,
  children: [CHILD_NODE],
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return Wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRename.mockResolvedValue({ success: true })
  mockCreate.mockResolvedValue({ success: false })
  mockTrash.mockResolvedValue({ success: true })
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear()
  }
})

describe('PageTreeItem', () => {
  it('ページタイトルを描画する', () => {
    render(<PageTreeItem node={BASE_NODE} />, { wrapper: makeWrapper() })
    expect(screen.getByText('テストページ')).toBeInTheDocument()
  })

  it('子がない場合は展開ボタンが不可視になる', () => {
    render(<PageTreeItem node={BASE_NODE} />, { wrapper: makeWrapper() })
    const toggleBtn = screen.queryByRole('button', { name: /展開する|折りたたむ/ })
    if (toggleBtn) {
      expect(toggleBtn).toHaveClass('invisible')
    }
  })

  it('子がある場合は展開ボタンで子が表示される', async () => {
    const user = userEvent.setup()
    render(<PageTreeItem node={NODE_WITH_CHILDREN} />, { wrapper: makeWrapper() })

    expect(screen.queryByText('子ページ')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '展開する' }))
    expect(screen.getByText('子ページ')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '折りたたむ' }))
    expect(screen.queryByText('子ページ')).not.toBeInTheDocument()
  })

  it('アイコンがある場合はアイコンを表示する', () => {
    const nodeWithIcon = { ...BASE_NODE, icon: '📝' }
    render(<PageTreeItem node={nodeWithIcon} />, { wrapper: makeWrapper() })
    expect(screen.getByText('📝')).toBeInTheDocument()
  })

  it('タイトルが空の場合は「無題」を表示する', () => {
    const nodeNoTitle = { ...BASE_NODE, title: '' }
    render(<PageTreeItem node={nodeNoTitle} />, { wrapper: makeWrapper() })
    expect(screen.getByText('無題')).toBeInTheDocument()
  })

  it('currentPageId が一致するとアクティブスタイルが適用される', () => {
    render(<PageTreeItem node={BASE_NODE} currentPageId={BASE_NODE.id} />, { wrapper: makeWrapper() })
    // アクティブな要素にはクラスが適用される（bg-muted など）
    const itemDiv = document.querySelector('.bg-muted')
    expect(itemDiv).toBeTruthy()
  })

  describe('rename インライン編集', () => {
    it('メニューから名前を変更をクリックするとインライン input が表示される', async () => {
      const user = userEvent.setup()
      render(<PageTreeItem node={BASE_NODE} />, { wrapper: makeWrapper() })

      // ページメニューボタンをクリックしてメニューを開く
      const menuBtn = screen.getByRole('button', { name: 'ページメニュー' })
      await user.click(menuBtn)

      const renameItem = await screen.findByText('名前を変更')
      await user.click(renameItem)

      // インライン input が表示されることを確認
      expect(screen.getByDisplayValue('テストページ')).toBeInTheDocument()
    })

    it('rename 中に Enter を押すと rename が呼ばれる', async () => {
      const user = userEvent.setup()
      render(<PageTreeItem node={BASE_NODE} />, { wrapper: makeWrapper() })

      const menuBtn = screen.getByRole('button', { name: 'ページメニュー' })
      await user.click(menuBtn)
      const renameItem = await screen.findByText('名前を変更')
      await user.click(renameItem)

      const input = screen.getByDisplayValue('テストページ')
      await user.clear(input)
      await user.type(input, '新しい名前{Enter}')

      expect(mockRename).toHaveBeenCalledWith(
        expect.objectContaining({ id: BASE_NODE.id, title: '新しい名前' })
      )
    })

    it('rename 中に Escape を押すと元に戻りモードを終了する', async () => {
      const user = userEvent.setup()
      render(<PageTreeItem node={BASE_NODE} />, { wrapper: makeWrapper() })

      const menuBtn = screen.getByRole('button', { name: 'ページメニュー' })
      await user.click(menuBtn)
      const renameItem = await screen.findByText('名前を変更')
      await user.click(renameItem)

      const input = screen.getByDisplayValue('テストページ')
      await user.clear(input)
      await user.type(input, '変更後')
      await user.keyboard('{Escape}')

      // input が消えてリンク表示に戻る
      expect(screen.queryByDisplayValue('変更後')).not.toBeInTheDocument()
      // rename は呼ばれない
      expect(mockRename).not.toHaveBeenCalled()
    })

    it('rename 中に blur するとタイトルが変わっていれば rename を呼ぶ', async () => {
      const user = userEvent.setup()
      render(<PageTreeItem node={BASE_NODE} />, { wrapper: makeWrapper() })

      const menuBtn = screen.getByRole('button', { name: 'ページメニュー' })
      await user.click(menuBtn)
      const renameItem = await screen.findByText('名前を変更')
      await user.click(renameItem)

      const input = screen.getByDisplayValue('テストページ')
      await user.clear(input)
      await user.type(input, '更新されたタイトル')
      await user.tab()

      expect(mockRename).toHaveBeenCalledWith(
        expect.objectContaining({ id: BASE_NODE.id, title: '更新されたタイトル' })
      )
    })

    it('rename 中に blur してもタイトルが同じなら rename を呼ばない', async () => {
      const user = userEvent.setup()
      render(<PageTreeItem node={BASE_NODE} />, { wrapper: makeWrapper() })

      const menuBtn = screen.getByRole('button', { name: 'ページメニュー' })
      await user.click(menuBtn)
      const renameItem = await screen.findByText('名前を変更')
      await user.click(renameItem)

      // タイトルを変えずに blur（input は使わずに tab でフォーカスを外す）
      screen.getByDisplayValue('テストページ')
      await user.tab()

      expect(mockRename).not.toHaveBeenCalled()
      // モードを抜けるだけ
      expect(screen.queryByDisplayValue('テストページ')).not.toBeInTheDocument()
    })
  })
})
