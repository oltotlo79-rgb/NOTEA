import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listTrashedPages = vi.fn()
vi.mock('@/lib/actions/pages', () => ({
  listTrashedPages: (...args: unknown[]) => listTrashedPages(...args),
}))

const { useTrashedPages } = await import('@/hooks/use-trashed-pages')

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return Wrapper
}

const PAGE_1 = {
  id: 'a0000001-0000-4000-8000-000000000001',
  title: 'Trashed 1',
  icon: null,
  trashed_at: '2026-01-10T00:00:00Z',
}
const PAGE_2 = {
  id: 'a0000002-0000-4000-8000-000000000002',
  title: 'Trashed 2',
  icon: null,
  trashed_at: '2026-01-09T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useTrashedPages', () => {
  it('初回ロードでページ一覧を返す', async () => {
    listTrashedPages.mockResolvedValueOnce({ data: [PAGE_1, PAGE_2] })

    const { result } = renderHook(() => useTrashedPages(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.items).toHaveLength(2)
    expect(result.current.items.at(0)?.id).toBe(PAGE_1.id)
  })

  it('nextCursor がある場合 hasMore が true になる', async () => {
    listTrashedPages.mockResolvedValueOnce({
      data: [PAGE_1],
      nextCursor: '2026-01-09T00:00:00Z',
    })

    const { result } = renderHook(() => useTrashedPages(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasMore).toBe(true)
    expect(result.current.nextCursor).toBe('2026-01-09T00:00:00Z')
  })

  it('nextCursor がない場合 hasMore が false になる', async () => {
    listTrashedPages.mockResolvedValueOnce({ data: [PAGE_1] })

    const { result } = renderHook(() => useTrashedPages(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasMore).toBe(false)
  })

  it('loadMore を呼ぶと cursor 付きで再取得する', async () => {
    listTrashedPages
      .mockResolvedValueOnce({ data: [PAGE_1], nextCursor: '2026-01-09T00:00:00Z' })
      .mockResolvedValueOnce({ data: [PAGE_2] })

    const { result } = renderHook(() => useTrashedPages(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.loadMore()
    })

    await waitFor(() => expect(listTrashedPages).toHaveBeenCalledTimes(2))
    expect(listTrashedPages).toHaveBeenNthCalledWith(2, '2026-01-09T00:00:00Z')
  })

  it('エラー時に error が設定される', async () => {
    listTrashedPages.mockResolvedValueOnce({ data: [], error: 'DB エラー' })

    const { result } = renderHook(() => useTrashedPages(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
    expect(result.current.error?.message).toBe('DB エラー')
  })
})
