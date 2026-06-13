import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/pages',
}))

vi.mock('@/lib/actions/auth', () => ({
  signOut: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/hooks/use-page-mutations', () => ({
  usePageMutations: () => ({
    create: vi.fn().mockResolvedValue({ success: false }),
    rename: vi.fn(),
    trash: vi.fn(),
    restore: vi.fn(),
    deletePermanently: vi.fn(),
    move: vi.fn(),
    reorder: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-page-tree', () => ({
  usePageTree: () => ({ isLoading: false, data: [], error: null }),
}))

const { AppShell } = await import('@/components/layout/AppShell')

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
})

describe('AppShell', () => {
  it('children を描画する', () => {
    render(
      <AppShell userEmail="test@example.com">
        <div data-testid="main-content">メインコンテンツ</div>
      </AppShell>,
      { wrapper: makeWrapper() }
    )
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  it('デスクトップ用サイドバー折りたたみボタンが存在する', () => {
    render(
      <AppShell userEmail="test@example.com">
        <div>コンテンツ</div>
      </AppShell>,
      { wrapper: makeWrapper() }
    )
    expect(screen.getByRole('button', { name: 'サイドバーを切り替え' })).toBeInTheDocument()
  })

  it('モバイル用サイドバー開くボタンが存在する', () => {
    render(
      <AppShell userEmail="test@example.com">
        <div>コンテンツ</div>
      </AppShell>,
      { wrapper: makeWrapper() }
    )
    expect(screen.getByRole('button', { name: 'サイドバーを開く' })).toBeInTheDocument()
  })

  it('デスクトップ折りたたみボタンをクリックするとサイドバーの幅が変わる', async () => {
    const user = userEvent.setup()
    render(
      <AppShell userEmail="test@example.com">
        <div>コンテンツ</div>
      </AppShell>,
      { wrapper: makeWrapper() }
    )

    const toggleBtn = screen.getByRole('button', { name: 'サイドバーを切り替え' })
    const aside = document.querySelector('aside')
    expect(aside).toBeTruthy()

    // 初期状態: 幅 260px
    expect(aside?.style.width).toBe('260px')

    await user.click(toggleBtn)
    // 折りたたみ後: 幅 0px
    expect(aside?.style.width).toBe('0px')
  })
})
