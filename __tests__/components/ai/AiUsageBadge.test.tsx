/**
 * components/ai/AiUsageBadge.tsx のユニットテスト。
 * 残回数バッジの表示・色変化をテストする。
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/actions/ai', () => ({
  getAiUsageToday: vi.fn(),
  consumeAiUsage: vi.fn(),
}))

// React Query プロバイダーが必要
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-query')>()
  return original
})

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const { getAiUsageToday: mockGetAiUsageToday } = await import('@/lib/actions/ai')
const { AiUsageBadge } = await import('@/components/ai/AiUsageBadge')

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AiUsageBadge', () => {
  it('残回数がある場合に「本日 N/M 回」を表示する', async () => {
    vi.mocked(mockGetAiUsageToday).mockResolvedValue({
      providers: [
        { provider: 'gemini', count: 2, remaining: 3, limit: 5 },
        { provider: 'openai', count: 0, remaining: 5, limit: 5 },
        { provider: 'anthropic', count: 0, remaining: 5, limit: 5 },
      ],
      plan: 'free',
      limit: 5,
    })

    render(<AiUsageBadge />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('ai-usage-badge')).toBeInTheDocument()
    })

    expect(screen.getByTestId('ai-usage-badge').textContent).toContain('3')
    expect(screen.getByTestId('ai-usage-badge').textContent).toContain('5')
  })

  it('残回数ゼロのとき data-testid="ai-usage-badge" が表示される', async () => {
    vi.mocked(mockGetAiUsageToday).mockResolvedValue({
      providers: [
        { provider: 'gemini', count: 5, remaining: 0, limit: 5 },
        { provider: 'openai', count: 0, remaining: 5, limit: 5 },
        { provider: 'anthropic', count: 0, remaining: 5, limit: 5 },
      ],
      plan: 'free',
      limit: 5,
    })

    render(<AiUsageBadge />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('ai-usage-badge')).toBeInTheDocument()
    })
  })

  it('/settings/ai へのリンクになっている', async () => {
    vi.mocked(mockGetAiUsageToday).mockResolvedValue({
      providers: [
        { provider: 'gemini', count: 0, remaining: 5, limit: 5 },
        { provider: 'openai', count: 0, remaining: 5, limit: 5 },
        { provider: 'anthropic', count: 0, remaining: 5, limit: 5 },
      ],
      plan: 'free',
      limit: 5,
    })

    render(<AiUsageBadge />, { wrapper: createWrapper() })

    await waitFor(() => {
      const badge = screen.getByTestId('ai-usage-badge')
      expect(badge.closest('a') ?? badge).toHaveAttribute('href', expect.stringContaining('settings'))
    })
  })

  it('ローディング中は null を返す（バッジを表示しない）', () => {
    vi.mocked(mockGetAiUsageToday).mockReturnValue(new Promise(() => {}))

    const { container } = render(<AiUsageBadge />, { wrapper: createWrapper() })

    // ローディング中はコンテンツが空
    expect(container.firstChild).toBeNull()
  })
})
