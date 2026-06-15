/**
 * components/settings/AiUsagePanel.tsx のユニットテスト。
 * 残回数・使用回数・プログレスバー・プラン別メッセージをテストする。
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/actions/ai', () => ({
  getAiUsageToday: vi.fn(),
  consumeAiUsage: vi.fn(),
}))

vi.mock('@/hooks/use-ai-usage', () => ({
  useAiUsage: vi.fn().mockReturnValue({
    plan: 'free',
    limit: 5,
    totalUsed: 2,
    remaining: 3,
    isLoading: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const { useAiUsage } = await import('@/hooks/use-ai-usage')
const { AiUsagePanel } = await import('@/components/settings/AiUsagePanel')

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAiUsage).mockReturnValue({
    plan: 'free',
    limit: 5,
    totalUsed: 2,
    remaining: 3,
    isLoading: false,
    refetch: vi.fn(),
  })
})

describe('AiUsagePanel - 基本表示', () => {
  it('「今日の AI 残回数」ヘッダが表示される', () => {
    render(
      <AiUsagePanel initialRemaining={3} initialLimit={5} initialPlan="free" />,
      { wrapper: createWrapper() }
    )
    expect(document.body.textContent).toContain('今日の AI 残回数')
  })

  it('使用回数と上限が表示される（N / M 回）', async () => {
    render(
      <AiUsagePanel initialRemaining={3} initialLimit={5} initialPlan="free" />,
      { wrapper: createWrapper() }
    )
    await waitFor(() => {
      expect(document.body.textContent).toContain('2')
      expect(document.body.textContent).toContain('5')
    })
  })

  it('残回数が表示される', async () => {
    render(
      <AiUsagePanel initialRemaining={3} initialLimit={5} initialPlan="free" />,
      { wrapper: createWrapper() }
    )
    await waitFor(() => {
      expect(document.body.textContent).toContain('3')
    })
  })

  it('リセット時間の説明が表示される', () => {
    render(
      <AiUsagePanel initialRemaining={3} initialLimit={5} initialPlan="free" />,
      { wrapper: createWrapper() }
    )
    expect(document.body.textContent).toContain('JST')
  })
})

describe('AiUsagePanel - プログレスバー', () => {
  it('progressbar ロールが存在する', () => {
    render(
      <AiUsagePanel initialRemaining={3} initialLimit={5} initialPlan="free" />,
      { wrapper: createWrapper() }
    )
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('aria-valuenow が使用回数と一致する', async () => {
    render(
      <AiUsagePanel initialRemaining={3} initialLimit={5} initialPlan="free" />,
      { wrapper: createWrapper() }
    )
    await waitFor(() => {
      const bar = screen.getByRole('progressbar')
      expect(bar).toHaveAttribute('aria-valuenow', '2')
    })
  })
})

describe('AiUsagePanel - プラン別メッセージ', () => {
  it('無料プランではアップグレード案内が表示される', async () => {
    render(
      <AiUsagePanel initialRemaining={3} initialLimit={5} initialPlan="free" />,
      { wrapper: createWrapper() }
    )
    await waitFor(() => {
      expect(document.body.textContent).toContain('プレミアムプラン')
    })
  })

  it('有料プランではアップグレード案内が表示されない', async () => {
    vi.mocked(useAiUsage).mockReturnValue({
      plan: 'paid',
      limit: 100,
      totalUsed: 10,
      remaining: 90,
      isLoading: false,
      refetch: vi.fn(),
    })

    render(
      <AiUsagePanel initialRemaining={90} initialLimit={100} initialPlan="paid" />,
      { wrapper: createWrapper() }
    )
    await waitFor(() => {
      expect(document.body.textContent).toContain('プレミアムプラン')
      // プレミアムプランラベルは表示されるがアップグレード案内リンクは非表示
      expect(screen.queryByText(/アップグレード/)).not.toBeInTheDocument()
    })
  })

  it('有料プランでは「プレミアムプラン」ラベルが表示される', async () => {
    vi.mocked(useAiUsage).mockReturnValue({
      plan: 'paid',
      limit: 100,
      totalUsed: 5,
      remaining: 95,
      isLoading: false,
      refetch: vi.fn(),
    })

    render(
      <AiUsagePanel initialRemaining={95} initialLimit={100} initialPlan="paid" />,
      { wrapper: createWrapper() }
    )
    await waitFor(() => {
      expect(document.body.textContent).toContain('プレミアムプラン')
    })
  })
})

describe('AiUsagePanel - 初期値フォールバック', () => {
  it('useAiUsage がローディング中は SSR の初期値を表示する', () => {
    vi.mocked(useAiUsage).mockReturnValue({
      plan: undefined as unknown as 'free',
      limit: undefined as unknown as number,
      totalUsed: undefined as unknown as number,
      remaining: undefined as unknown as number,
      isLoading: true,
      refetch: vi.fn(),
    })

    render(
      <AiUsagePanel initialRemaining={4} initialLimit={5} initialPlan="free" />,
      { wrapper: createWrapper() }
    )
    // 初期値を表示
    expect(document.body.textContent).toContain('4')
    expect(document.body.textContent).toContain('5')
  })
})
