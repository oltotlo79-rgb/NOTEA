/**
 * hooks/use-ai-usage.ts のユニットテスト。
 * React Query でラップした getAiUsageToday Server Action をテストする。
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Server Action をモック
vi.mock('@/lib/actions/ai', () => ({
  getAiUsageToday: vi.fn(),
  consumeAiUsage: vi.fn(),
}))

const { getAiUsageToday: mockGetAiUsageToday } = await import('@/lib/actions/ai')
const { useAiUsage } = await import('@/hooks/use-ai-usage')

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

describe('useAiUsage', () => {
  it('初期状態は isLoading=true', () => {
    vi.mocked(mockGetAiUsageToday).mockResolvedValue({
      providers: [],
      plan: 'free',
      limit: 5,
    })

    const { result } = renderHook(() => useAiUsage(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
  })

  it('正常系(無料): remaining/limit/totalUsed を正しく計算する', async () => {
    vi.mocked(mockGetAiUsageToday).mockResolvedValue({
      providers: [
        { provider: 'gemini', count: 2, remaining: 3, limit: 5 },
        { provider: 'openai', count: 0, remaining: 5, limit: 5 },
        { provider: 'anthropic', count: 0, remaining: 5, limit: 5 },
      ],
      plan: 'free',
      limit: 5,
    })

    const { result } = renderHook(() => useAiUsage(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.plan).toBe('free')
    expect(result.current.limit).toBe(5)
    expect(result.current.totalUsed).toBe(2)
    expect(result.current.remaining).toBe(3)
  })

  it('正常系(有料): limit=100 が反映される', async () => {
    vi.mocked(mockGetAiUsageToday).mockResolvedValue({
      providers: [
        { provider: 'gemini', count: 10, remaining: 90, limit: 100 },
        { provider: 'openai', count: 5, remaining: 95, limit: 100 },
        { provider: 'anthropic', count: 0, remaining: 100, limit: 100 },
      ],
      plan: 'paid',
      limit: 100,
    })

    const { result } = renderHook(() => useAiUsage(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.plan).toBe('paid')
    expect(result.current.limit).toBe(100)
    expect(result.current.totalUsed).toBe(15)
    expect(result.current.remaining).toBe(85)
  })

  it('データ未ロード時はデフォルト値を返す', () => {
    vi.mocked(mockGetAiUsageToday).mockResolvedValue({
      providers: [],
      plan: 'free',
      limit: 5,
    })

    const { result } = renderHook(() => useAiUsage(), {
      wrapper: createWrapper(),
    })

    // ロード前のデフォルト値
    expect(result.current.plan).toBe('free')
    expect(result.current.limit).toBe(5)
    expect(result.current.totalUsed).toBe(0)
    expect(result.current.remaining).toBe(5)
  })

  it('refetch 関数が提供される', async () => {
    vi.mocked(mockGetAiUsageToday).mockResolvedValue({
      providers: [],
      plan: 'free',
      limit: 5,
    })

    const { result } = renderHook(() => useAiUsage(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(typeof result.current.refetch).toBe('function')
  })
})
