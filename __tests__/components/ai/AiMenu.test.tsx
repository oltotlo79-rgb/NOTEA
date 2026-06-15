/**
 * components/ai/AiMenu.tsx のユニットテスト。
 * ガードロジック（鍵なし・上限超過・空コンテンツ）をテストする。
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// tanstack/react-query は useAiUsage/useHasAnyKey で使用
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-query')>()
  return original
})

vi.mock('@/lib/actions/ai', () => ({
  getAiUsageToday: vi.fn(),
  consumeAiUsage: vi.fn().mockResolvedValue({ success: true, data: { remaining: 4 } }),
}))

vi.mock('@/lib/ai/index', () => ({
  selectProvider: vi.fn().mockReturnValue('gemini'),
  generateWithSelectedProvider: vi.fn().mockResolvedValue({
    provider: 'gemini',
    result: { ok: true, stream: new ReadableStream<string>() },
  }),
  getLastUsedProvider: vi.fn().mockReturnValue(null),
  setLastUsedProvider: vi.fn(),
}))

vi.mock('@/hooks/use-ai-usage', () => ({
  useAiUsage: vi.fn().mockReturnValue({
    plan: 'free',
    limit: 5,
    totalUsed: 0,
    remaining: 5,
    isLoading: false,
    refetch: vi.fn(),
  }),
}))

// Node.js 25 native localStorage にはgetItem が無い
function makeMockLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value) }),
    removeItem: vi.fn((key: string) => { store.delete(key) }),
    clear: vi.fn(() => { store.clear() }),
    get length() { return store.size },
    key: vi.fn((i: number) => [...store.keys()][i] ?? null),
    _store: store,
  }
}

vi.mock('@/hooks/use-ai-key', () => ({
  useAiKey: () => ({
    hasKey: false,
    maskedKey: null,
    register: vi.fn(),
    remove: vi.fn(),
  }),
  useHasAnyKey: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/ai/prefs-storage', () => ({
  getLastTranslateLang: vi.fn().mockReturnValue({ source: '日本語', target: '英語' }),
  setLastTranslateLang: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

// DropdownMenu モック（jsdom でアクセシブルに開閉させる）
// vi.mock ファクトリは import より前にホイストされる。React を使う場合は
// importActual で取得する（require() スタイルは ESLint no-require-imports 違反のため）。
vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  const { useState } = React

  const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = useState(false)
    return React.createElement('div', { 'data-testid': 'dropdown-root' },
      React.Children.map(children as React.ReactElement[], (child: React.ReactElement) =>
        React.cloneElement(child, { _open: open, _setOpen: setOpen } as Partial<unknown>)
      )
    )
  }
  const DropdownMenuTrigger = ({ children, _setOpen, render: triggerRender, ...props }: { children?: React.ReactNode; _setOpen?: (v: boolean) => void; render?: React.ReactElement; [key: string]: unknown }) => {
    const handleClick = () => _setOpen?.(true)
    if (triggerRender) {
      // children を render エレメントの中に注入する（実際の @base-ui/react の動作を近似）
      // @ts-expect-error テスト用モック: children は ReactNode だが cloneElement の第3引数に渡す
      return React.cloneElement(triggerRender as React.ReactElement, { onClick: handleClick }, children)
    }
    return <button onClick={handleClick} {...props}>{children}</button>
  }
  const DropdownMenuContent = ({ children, _open }: { children: React.ReactNode; _open?: boolean }) => {
    if (!_open) return null
    return <div role="menu">{children}</div>
  }
  const DropdownMenuItem = ({ children, onClick, ...props }: { children: React.ReactNode; onClick?: () => void; [key: string]: unknown }) =>
    <button role="menuitem" onClick={onClick} {...props}>{children}</button>
  const DropdownMenuSeparator = () => <hr />
  const DropdownMenuSub = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const DropdownMenuSubTrigger = ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <button {...props}>{children}</button>
  const DropdownMenuSubContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
  }
})

vi.mock('@/components/ai/AiResultPreview', () => ({
  AiResultPreview: ({ open }: { open: boolean }) =>
    open ? <div data-testid="ai-result-preview-mock">プレビュー</div> : null,
}))

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useHasAnyKey } from '@/hooks/use-ai-key'
import { useAiUsage } from '@/hooks/use-ai-usage'
const { AiMenu } = await import('@/components/ai/AiMenu')

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function renderAiMenu(overrides = {}) {
  const defaultProps = {
    pageContentText: 'テストページの内容',
    onAskPanelOpen: vi.fn(),
    onInsertText: vi.fn(),
    onReplaceText: vi.fn(),
    onToast: vi.fn(),
    ...overrides,
  }
  return { ...render(<AiMenu {...defaultProps} />, { wrapper: createWrapper() }), props: defaultProps }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useHasAnyKey).mockReturnValue(false)
  vi.mocked(useAiUsage).mockReturnValue({
    plan: 'free',
    limit: 5,
    totalUsed: 0,
    remaining: 5,
    isLoading: false,
    refetch: vi.fn(),
  })
  vi.stubGlobal('localStorage', makeMockLocalStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AiMenu - 表示', () => {
  it('AI メニューボタンが表示される', () => {
    renderAiMenu()
    expect(screen.getByTestId('ai-menu-button')).toBeInTheDocument()
  })

  it('「AI」という文字が DOM に含まれている', () => {
    renderAiMenu()
    // ai-menu-button が DOM に存在し、その周辺に「AI」テキストがある
    expect(screen.getByTestId('ai-menu-button')).toBeInTheDocument()
    // DropdownMenuTrigger の children として AI テキストが含まれる
    expect(document.body.textContent).toContain('AI')
  })
})

describe('AiMenu - ガードロジック（鍵なし）', () => {
  it('鍵が未登録のとき「要約する」をクリックするとトーストを出す', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(false)
    const onToast = vi.fn()
    renderAiMenu({ onToast })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('ai-menu-button'))
    await user.click(screen.getByTestId('ai-menu-summarize'))

    expect(onToast).toHaveBeenCalledWith(
      expect.stringContaining('キー'),
      expect.any(String),
      expect.any(String)
    )
  })
})

describe('AiMenu - ガードロジック（上限超過）', () => {
  it('残回数ゼロのとき要約するをクリックするとトーストを出す', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(true)
    vi.mocked(useAiUsage).mockReturnValue({
      plan: 'free',
      limit: 5,
      totalUsed: 5,
      remaining: 0,
      isLoading: false,
      refetch: vi.fn(),
    })
    const onToast = vi.fn()
    renderAiMenu({ onToast })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('ai-menu-button'))
    await user.click(screen.getByTestId('ai-menu-summarize'))

    expect(onToast).toHaveBeenCalled()
  })
})

describe('AiMenu - ask パネル開閉', () => {
  it('「このページに質問する」をクリックすると onAskPanelOpen が呼ばれる', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(true)
    const onAskPanelOpen = vi.fn()
    renderAiMenu({ onAskPanelOpen })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('ai-menu-button'))
    await user.click(screen.getByTestId('ai-menu-ask'))

    expect(onAskPanelOpen).toHaveBeenCalled()
  })
})

describe('AiMenu - 正常系 summarize', () => {
  it('鍵あり・残回数ありなら要約操作でプレビューが開く', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(true)
    renderAiMenu()

    const user = userEvent.setup()
    await user.click(screen.getByTestId('ai-menu-button'))
    await user.click(screen.getByTestId('ai-menu-summarize'))

    // プレビューが開く（モック経由）
    await vi.waitFor(() => {
      expect(screen.getByTestId('ai-result-preview-mock')).toBeInTheDocument()
    })
  })
})

describe('AiMenu - 正常系 continue', () => {
  it('鍵あり・残回数ありなら「続きを書く」操作でプレビューが開く', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(true)
    renderAiMenu()

    const user = userEvent.setup()
    await user.click(screen.getByTestId('ai-menu-button'))
    await user.click(screen.getByTestId('ai-menu-continue'))

    await vi.waitFor(() => {
      expect(screen.getByTestId('ai-result-preview-mock')).toBeInTheDocument()
    })
  })
})

describe('AiMenu - 翻訳ガード（テキスト未選択）', () => {
  it('翻訳ボタンクリックでテキスト未選択時にトーストを出す', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(true)
    const onToast = vi.fn()
    renderAiMenu({ onToast, selectedText: '' })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('ai-menu-button'))
    await user.click(screen.getByTestId('ai-menu-translate'))

    // 翻訳のサブメニューアイテムをクリック（プリセット）
    const translateItems = screen.getAllByRole('menuitem')
    // 「日本語 → 英語」の翻訳プリセット
    const jaToEnItem = translateItems.find(el => el.textContent?.includes('日本語'))
    if (jaToEnItem) {
      await user.click(jaToEnItem)
    }

    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('選択'))
  })
})

describe('AiMenu - エラー系: 空コンテンツ', () => {
  it('コンテンツが空のとき要約するとトーストを出す', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(true)
    const onToast = vi.fn()
    renderAiMenu({ onToast, pageContentText: '' })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('ai-menu-button'))
    await user.click(screen.getByTestId('ai-menu-summarize'))

    expect(onToast).toHaveBeenCalled()
  })
})

describe('AiMenu - 有料プランのガード', () => {
  it('有料プラン上限超過でトーストに上限メッセージが出る', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(true)
    vi.mocked(useAiUsage).mockReturnValue({
      plan: 'paid',
      limit: 100,
      totalUsed: 100,
      remaining: 0,
      isLoading: false,
      refetch: vi.fn(),
    })
    const onToast = vi.fn()
    renderAiMenu({ onToast })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('ai-menu-button'))
    await user.click(screen.getByTestId('ai-menu-summarize'))

    expect(onToast).toHaveBeenCalled()
  })
})

describe('AiMenu - variant prop', () => {
  it('mobile-header variant でも AI ボタンが表示される', () => {
    renderAiMenu({ variant: 'mobile-header' })
    expect(screen.getByTestId('ai-menu-button')).toBeInTheDocument()
  })
})
