import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockRouterPush = vi.fn()

vi.mock('@/lib/actions/pages', () => ({
  updatePageMeta: vi.fn().mockResolvedValue({ success: true }),
  updatePageContent: vi.fn().mockResolvedValue({ success: true }),
}))

// PageView は M4 で useRouter を使うようになった（AI ask パネル後に遷移するため）
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn(), back: vi.fn(), forward: vi.fn() }),
  usePathname: () => '/pages/test-id',
  useSearchParams: () => new URLSearchParams(),
}))

// AiMenu / use-ai-key は localStorage を使う。Node.js 25 native localStorage は getItem 未実装。
// PageView のロジックテストでは AI 機能は副次的なのでフック全体をモックする。
vi.mock('@/hooks/use-ai-key', () => ({
  useAiKey: () => ({
    hasKey: false,
    maskedKey: null,
    register: vi.fn(),
    remove: vi.fn(),
  }),
  useHasAnyKey: () => false,
}))

vi.mock('@/hooks/use-ai-usage', () => ({
  useAiUsage: () => ({
    plan: 'free',
    limit: 5,
    totalUsed: 0,
    remaining: 5,
    isLoading: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/lib/actions/ai', () => ({
  getAiUsageToday: vi.fn(),
  consumeAiUsage: vi.fn(),
}))

vi.mock('@/lib/ai/index', () => ({
  selectProvider: vi.fn().mockReturnValue(null),
  generateWithSelectedProvider: vi.fn(),
}))

vi.mock('@/lib/ai/prefs-storage', () => ({
  getLastTranslateLang: vi.fn().mockReturnValue({ source: '日本語', target: '英語' }),
  setLastTranslateLang: vi.fn(),
}))

vi.mock('@/components/ai/AiAskPanel', () => ({
  AiAskPanel: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="ai-ask-panel-stub"><button onClick={onClose}>閉じる</button></div> : null,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: () => null,
  DropdownMenuItem: () => null,
  DropdownMenuSeparator: () => null,
  DropdownMenuSub: () => null,
  DropdownMenuSubTrigger: () => null,
  DropdownMenuSubContent: () => null,
}))

// EditorDynamic は next/dynamic（ssr:false）を使うため jsdom では EditorSkeleton のみ描画する
vi.mock('@/components/editor/EditorDynamic', () => ({
  EditorDynamic: ({ onAskPanelOpen }: { onAskPanelOpen?: () => void; [key: string]: unknown }) => (
    <div aria-label="エディタ読み込み中" data-testid="editor-dynamic-stub">
      <button data-testid="trigger-ask-panel" onClick={onAskPanelOpen}>ask</button>
    </div>
  ),
}))

const { PageView } = await import('@/components/page/PageView')

const PAGE_DETAIL = {
  id: 'a0000001-0000-4000-8000-000000000001',
  parent_id: null,
  title: 'テストページ',
  icon: '📝',
  content: null,
  content_text: '',
  updated_at: '2026-01-01T00:00:00Z',
  is_trashed: false,
}

function renderWithQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client: queryClient }, ui))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PageView', () => {
  it('ページタイトルを描画する', () => {
    renderWithQuery(<PageView page={PAGE_DETAIL} />)
    expect(screen.getByDisplayValue('テストページ')).toBeInTheDocument()
  })

  it('EditorDynamic コンポーネントを描画する（BlockNote はスタブ）', () => {
    renderWithQuery(<PageView page={PAGE_DETAIL} />)
    expect(screen.getByTestId('editor-dynamic-stub')).toBeInTheDocument()
  })

  it('AI 質問パネルは初期状態で非表示', () => {
    renderWithQuery(<PageView page={PAGE_DETAIL} />)
    expect(screen.queryByTestId('ai-ask-panel-stub')).not.toBeInTheDocument()
  })

  it('onAskPanelOpen が呼ばれると AI 質問パネルが表示される', async () => {
    renderWithQuery(<PageView page={PAGE_DETAIL} />)
    const user = userEvent.setup()
    await user.click(screen.getByTestId('trigger-ask-panel'))
    expect(screen.getByTestId('ai-ask-panel-stub')).toBeInTheDocument()
  })

  it('AI パネルを閉じると非表示になる', async () => {
    renderWithQuery(<PageView page={PAGE_DETAIL} />)
    const user = userEvent.setup()
    await user.click(screen.getByTestId('trigger-ask-panel'))
    expect(screen.getByTestId('ai-ask-panel-stub')).toBeInTheDocument()
    await user.click(screen.getByText('閉じる'))
    expect(screen.queryByTestId('ai-ask-panel-stub')).not.toBeInTheDocument()
  })
})

describe('PageView - トースト通知', () => {
  it('初期状態でトーストは表示されない', () => {
    renderWithQuery(<PageView page={PAGE_DETAIL} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
