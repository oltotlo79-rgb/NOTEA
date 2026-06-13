import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPageTree = vi.fn()
vi.mock('@/lib/actions/pages', () => ({
  getPageTree: (...args: unknown[]) => getPageTree(...args),
}))

const { usePageTree } = await import('@/hooks/use-page-tree')

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return Wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('usePageTree', () => {
  it('getPageTree 成功→ data を返す', async () => {
    const pages = [
      { id: 'a0000001-0000-4000-8000-000000000001', parent_id: null, title: 'Page 1', icon: null, sort_order: 0 },
    ]
    getPageTree.mockResolvedValueOnce({ data: pages })

    const { result } = renderHook(() => usePageTree(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(pages)
  })

  it('getPageTree が error を返す→ isError が true になる', async () => {
    getPageTree.mockResolvedValueOnce({ data: [], error: 'データの読み書きに失敗しました' })

    const { result } = renderHook(() => usePageTree(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toContain('データの読み書き')
  })

  it('queryKey が [page-tree]', async () => {
    getPageTree.mockResolvedValueOnce({ data: [] })

    const { result } = renderHook(() => usePageTree(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getPageTree).toHaveBeenCalledTimes(1)
  })
})
