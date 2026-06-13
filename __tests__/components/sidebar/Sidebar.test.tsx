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

const mockSignOut = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}))

const mockCreate = vi.fn()
vi.mock('@/hooks/use-page-mutations', () => ({
  usePageMutations: () => ({
    create: mockCreate,
    rename: vi.fn(),
    trash: vi.fn(),
    restore: vi.fn(),
    deletePermanently: vi.fn(),
    move: vi.fn(),
    reorder: vi.fn(),
  }),
}))

const mockUsePageTree = vi.fn()
vi.mock('@/hooks/use-page-tree', () => ({
  usePageTree: () => mockUsePageTree(),
}))

const { Sidebar } = await import('@/components/sidebar/Sidebar')

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
  if (typeof localStorage !== 'undefined' && localStorage.clear) {
    localStorage.clear()
  }
  mockUsePageTree.mockReturnValue({ isLoading: false, data: [], error: null })
})

describe('Sidebar', () => {
  it('ブランド名 Notea を表示する', () => {
    render(<Sidebar />, { wrapper: makeWrapper() })
    expect(screen.getByText('Notea')).toBeInTheDocument()
  })

  it('新規ページ作成ボタンが存在する', () => {
    render(<Sidebar />, { wrapper: makeWrapper() })
    expect(screen.getByRole('button', { name: '新規ページを作成' })).toBeInTheDocument()
  })

  it('新規ページボタンをクリックすると createPage を呼び、成功時に /pages/[id] へ遷移する', async () => {
    mockCreate.mockResolvedValueOnce({ success: true, data: { id: NEW_PAGE_ID } })
    const user = userEvent.setup()

    render(<Sidebar />, { wrapper: makeWrapper() })
    await user.click(screen.getByRole('button', { name: '新規ページを作成' }))

    expect(mockCreate).toHaveBeenCalledWith({})
    expect(push).toHaveBeenCalledWith(`/pages/${NEW_PAGE_ID}`)
  })

  it('ごみ箱リンクが存在する', () => {
    render(<Sidebar />, { wrapper: makeWrapper() })
    expect(screen.getByRole('link', { name: /ごみ箱/ })).toBeInTheDocument()
  })
})
