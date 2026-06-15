/**
 * components/ai/AiAskPanel.tsx のユニットテスト。
 * パネル表示・質問送信ガード・エラー状態をテストする。
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@/hooks/use-ai-key', () => ({
  useHasAnyKey: vi.fn().mockReturnValue(false),
  useAiKey: () => ({
    hasKey: false,
    maskedKey: null,
    register: vi.fn(),
    remove: vi.fn(),
  }),
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="sheet-mock">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useHasAnyKey } from '@/hooks/use-ai-key'
import { useAiUsage } from '@/hooks/use-ai-usage'

const { AiAskPanel } = await import('@/components/ai/AiAskPanel')

// jsdom は scrollIntoView を未実装。noop でスタブする。
window.HTMLElement.prototype.scrollIntoView = vi.fn()

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function renderPanel(isOpen = true, overrides = {}) {
  const props = {
    pageContentText: 'テストページの内容',
    isOpen,
    onClose: vi.fn(),
    ...overrides,
  }
  return { ...render(<AiAskPanel {...props} />, { wrapper: createWrapper() }), props }
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
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AiAskPanel - パネル表示', () => {
  it('isOpen=true のとき質問パネルが表示される（デスクトップ・モバイル双方）', () => {
    renderPanel(true)
    // コンポーネントはデスクトップ div と Sheet (モバイル) の 2 箇所で AskPanelContent を描画する
    const panels = screen.getAllByTestId('ai-ask-panel')
    expect(panels.length).toBeGreaterThanOrEqual(1)
  })

  it('isOpen=false のとき Sheet が非表示', () => {
    renderPanel(false)
    // Sheet mock: isOpen=false なら null を返す
    expect(screen.queryByTestId('sheet-mock')).not.toBeInTheDocument()
  })

  it('「AI」「質問」というテキストが DOM に含まれる', () => {
    renderPanel()
    expect(document.body.textContent).toContain('AI')
    expect(document.body.textContent).toContain('質問')
  })

  it('入力欄が表示される', () => {
    renderPanel()
    const inputs = screen.getAllByTestId('ai-ask-input')
    expect(inputs.length).toBeGreaterThanOrEqual(1)
  })

  it('初期状態のプレースホルダーメッセージが表示される', () => {
    renderPanel()
    expect(document.body.textContent).toContain('質問すると')
  })
})

describe('AiAskPanel - ガードロジック（鍵なし）', () => {
  it('鍵が未登録のまま送信するとエラーが表示される', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(false)
    renderPanel()
    const user = userEvent.setup()

    // 複数の入力欄がある（デスクトップ + Sheet）。最初のものを使う。
    const [firstInput] = screen.getAllByTestId('ai-ask-input')
    await user.type(firstInput!, '要約してください')
    const [firstSubmit] = screen.getAllByTestId('ai-ask-submit')
    await user.click(firstSubmit!)

    await waitFor(() => {
      expect(document.body.textContent).toContain('キー')
    })
  })
})

describe('AiAskPanel - ガードロジック（上限超過）', () => {
  it('残回数ゼロのとき送信するとエラーが表示される', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(true)
    vi.mocked(useAiUsage).mockReturnValue({
      plan: 'free',
      limit: 5,
      totalUsed: 5,
      remaining: 0,
      isLoading: false,
      refetch: vi.fn(),
    })

    renderPanel()
    const user = userEvent.setup()

    const [firstInput] = screen.getAllByTestId('ai-ask-input')
    await user.type(firstInput!, '要約して')
    const [firstSubmit] = screen.getAllByTestId('ai-ask-submit')
    await user.click(firstSubmit!)

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/上限|制限|回/)
    })
  })
})

describe('AiAskPanel - 閉じる', () => {
  it('「閉じる」ボタンクリックで onClose が呼ばれる', async () => {
    const onClose = vi.fn()
    renderPanel(true, { onClose })
    const user = userEvent.setup()

    // デスクトップとモバイルで複数の閉じるボタンがある
    const [firstCloseButton] = screen.getAllByLabelText('質問パネルを閉じる')
    await user.click(firstCloseButton!)

    expect(onClose).toHaveBeenCalled()
  })
})

describe('AiAskPanel - モバイル Sheet', () => {
  it('Sheet は isOpen=true のとき表示される', () => {
    renderPanel(true)
    expect(screen.getByTestId('sheet-mock')).toBeInTheDocument()
  })
})

describe('AiAskPanel - 送信フロー（鍵あり）', () => {
  it('鍵あり・残回数ありで送信すると consumeAiUsage が呼ばれる', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(true)
    const { consumeAiUsage } = await import('@/lib/actions/ai')
    vi.mocked(consumeAiUsage).mockResolvedValue({ success: true, data: { remaining: 4 } })

    renderPanel()
    const user = userEvent.setup()

    const [firstInput] = screen.getAllByTestId('ai-ask-input')
    await user.type(firstInput!, '質問です')
    const [firstSubmit] = screen.getAllByTestId('ai-ask-submit')
    await user.click(firstSubmit!)

    // selectProvider が gemini を返すので consumeAiUsage が呼ばれる
    await vi.waitFor(() => {
      expect(consumeAiUsage).toHaveBeenCalled()
    })
  })

  it('consumeAiUsage が失敗するとエラーメッセージが表示される', async () => {
    vi.mocked(useHasAnyKey).mockReturnValue(true)
    const { consumeAiUsage } = await import('@/lib/actions/ai')
    vi.mocked(consumeAiUsage).mockResolvedValue({ success: false, error: '上限に達しました' })

    renderPanel()
    const user = userEvent.setup()

    const [firstInput] = screen.getAllByTestId('ai-ask-input')
    await user.type(firstInput!, '質問')
    const [firstSubmit] = screen.getAllByTestId('ai-ask-submit')
    await user.click(firstSubmit!)

    await waitFor(() => {
      expect(document.body.textContent).toContain('上限')
    })
  })
})
