import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const searchPages = vi.fn()
vi.mock('@/lib/actions/search', () => ({
  searchPages: (...args: unknown[]) => searchPages(...args),
}))

const { useSearch } = await import('@/hooks/use-search')

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return Wrapper
}

const RESULT_1 = {
  id: 'a0000001-0000-4000-8000-000000000001',
  title: 'Next.js',
  icon: null,
  updatedAt: '2026-06-17T00:00:00.000Z',
  snippet: 'snippet 1',
}
const RESULT_2 = {
  id: 'a0000002-0000-4000-8000-000000000002',
  title: 'TypeScript',
  icon: null,
  updatedAt: '2026-06-16T00:00:00.000Z',
  snippet: 'snippet 2',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSearch', () => {
  it('初期状態ではクエリ空・結果なし・action 未呼び出し', () => {
    const { result } = renderHook(() => useSearch(), { wrapper: makeWrapper() })
    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
    expect(searchPages).not.toHaveBeenCalled()
  })

  it('debounce 後にクエリで検索し結果を返す', async () => {
    searchPages.mockResolvedValueOnce({ data: [RESULT_1, RESULT_2] })
    const { result } = renderHook(() => useSearch(), { wrapper: makeWrapper() })

    act(() => result.current.setQuery('Next'))

    await waitFor(() => expect(searchPages).toHaveBeenCalledWith('Next', undefined))
    await waitFor(() => expect(result.current.results).toHaveLength(2))
  })

  it('空白のみのクエリでは action を呼ばない', async () => {
    const { result } = renderHook(() => useSearch(), { wrapper: makeWrapper() })

    act(() => result.current.setQuery('   '))

    await waitFor(() => expect(result.current.debouncedQuery).toBe(''))
    expect(searchPages).not.toHaveBeenCalled()
  })

  it('nextCursor があるとき hasMore が true になり loadMore で追加取得する', async () => {
    searchPages
      .mockResolvedValueOnce({ data: [RESULT_1], nextCursor: RESULT_1.updatedAt })
      .mockResolvedValueOnce({ data: [RESULT_2] })

    const { result } = renderHook(() => useSearch(), { wrapper: makeWrapper() })
    act(() => result.current.setQuery('a'))

    await waitFor(() => expect(result.current.hasMore).toBe(true))

    act(() => result.current.loadMore())

    await waitFor(() => expect(searchPages).toHaveBeenNthCalledWith(2, 'a', RESULT_1.updatedAt))
    await waitFor(() => expect(result.current.results).toHaveLength(2))
  })

  it('error が返ると error が設定される', async () => {
    searchPages.mockResolvedValueOnce({ data: [], error: 'DB エラー' })
    const { result } = renderHook(() => useSearch(), { wrapper: makeWrapper() })

    act(() => result.current.setQuery('x'))

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
    expect(result.current.error?.message).toBe('DB エラー')
  })

  it('クエリを変更すると先頭から取り直す（cursor リセット）', async () => {
    searchPages
      .mockResolvedValueOnce({ data: [RESULT_1], nextCursor: RESULT_1.updatedAt })
      .mockResolvedValueOnce({ data: [RESULT_2] })

    const { result } = renderHook(() => useSearch(), { wrapper: makeWrapper() })

    act(() => result.current.setQuery('first'))
    await waitFor(() => expect(searchPages).toHaveBeenCalledWith('first', undefined))

    act(() => result.current.setQuery('second'))
    await waitFor(() => expect(searchPages).toHaveBeenCalledWith('second', undefined))
    expect(result.current.results).toEqual([RESULT_2])
  })
})
