import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createPage = vi.fn()
const updatePageMeta = vi.fn()
const trashPage = vi.fn()
const restorePage = vi.fn()
const deletePagePermanently = vi.fn()
const movePage = vi.fn()
const reorderPage = vi.fn()

vi.mock('@/lib/actions/pages', () => ({
  createPage: (...args: unknown[]) => createPage(...args),
  updatePageMeta: (...args: unknown[]) => updatePageMeta(...args),
  trashPage: (...args: unknown[]) => trashPage(...args),
  restorePage: (...args: unknown[]) => restorePage(...args),
  deletePagePermanently: (...args: unknown[]) => deletePagePermanently(...args),
  movePage: (...args: unknown[]) => movePage(...args),
  reorderPage: (...args: unknown[]) => reorderPage(...args),
}))

const { usePageMutations } = await import('@/hooks/use-page-mutations')

const ID_1 = 'a0000001-0000-4000-8000-000000000001'
const ID_2 = 'a0000002-0000-4000-8000-000000000002'

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return { queryClient, wrapper: Wrapper }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('usePageMutations', () => {
  describe('create', () => {
    it('createPage を呼び、成功時に page-tree を invalidate する', async () => {
      createPage.mockResolvedValueOnce({ success: true, data: { id: ID_1 } })
      const { queryClient, wrapper } = makeWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => usePageMutations(), { wrapper })
      const res = await result.current.create({})

      expect(createPage).toHaveBeenCalledWith({})
      expect(res.success).toBe(true)
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['page-tree'] })
    })

    it('失敗時は page-tree を invalidate しない', async () => {
      createPage.mockResolvedValueOnce({ success: false, error: 'エラー' })
      const { queryClient, wrapper } = makeWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => usePageMutations(), { wrapper })
      await result.current.create({})

      expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['page-tree'] })
    })
  })

  describe('rename', () => {
    it('updatePageMeta を呼び、成功時に page-tree を invalidate する', async () => {
      updatePageMeta.mockResolvedValueOnce({ success: true })
      const { queryClient, wrapper } = makeWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => usePageMutations(), { wrapper })
      await result.current.rename({ id: ID_1, title: '新しいタイトル' })

      expect(updatePageMeta).toHaveBeenCalledWith({ id: ID_1, title: '新しいタイトル' })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['page-tree'] })
    })
  })

  describe('trash', () => {
    it('trashPage を呼び、成功時に page-tree と trashed-pages を invalidate する', async () => {
      trashPage.mockResolvedValueOnce({ success: true })
      const { queryClient, wrapper } = makeWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => usePageMutations(), { wrapper })
      await result.current.trash(ID_1)

      expect(trashPage).toHaveBeenCalledWith(ID_1)
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['page-tree'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trashed-pages'] })
    })

    it('失敗時は invalidate しない', async () => {
      trashPage.mockResolvedValueOnce({ success: false, error: 'エラー' })
      const { queryClient, wrapper } = makeWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => usePageMutations(), { wrapper })
      await result.current.trash(ID_1)

      expect(invalidateSpy).not.toHaveBeenCalled()
    })
  })

  describe('restore', () => {
    it('restorePage を呼び、成功時に page-tree と trashed-pages を invalidate する', async () => {
      restorePage.mockResolvedValueOnce({ success: true })
      const { queryClient, wrapper } = makeWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => usePageMutations(), { wrapper })
      await result.current.restore(ID_1)

      expect(restorePage).toHaveBeenCalledWith(ID_1)
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['page-tree'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trashed-pages'] })
    })
  })

  describe('deletePermanently', () => {
    it('deletePagePermanently を呼び、成功時に trashed-pages を invalidate する', async () => {
      deletePagePermanently.mockResolvedValueOnce({ success: true })
      const { queryClient, wrapper } = makeWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => usePageMutations(), { wrapper })
      await result.current.deletePermanently(ID_1)

      expect(deletePagePermanently).toHaveBeenCalledWith(ID_1)
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trashed-pages'] })
    })

    it('deletePermanently 成功時は page-tree を invalidate しない', async () => {
      deletePagePermanently.mockResolvedValueOnce({ success: true })
      const { queryClient, wrapper } = makeWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => usePageMutations(), { wrapper })
      await result.current.deletePermanently(ID_1)

      const pageTreeCalls = invalidateSpy.mock.calls.filter(
        (c) => JSON.stringify(c[0]) === JSON.stringify({ queryKey: ['page-tree'] })
      )
      expect(pageTreeCalls).toHaveLength(0)
    })
  })

  describe('move', () => {
    it('movePage を呼び、成功時に page-tree を invalidate する', async () => {
      movePage.mockResolvedValueOnce({ success: true })
      const { queryClient, wrapper } = makeWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => usePageMutations(), { wrapper })
      await result.current.move({ id: ID_1, newParentId: ID_2 })

      expect(movePage).toHaveBeenCalledWith({ id: ID_1, newParentId: ID_2 })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['page-tree'] })
    })
  })

  describe('reorder', () => {
    it('reorderPage を呼び、成功時に page-tree を invalidate する', async () => {
      reorderPage.mockResolvedValueOnce({ success: true })
      const { queryClient, wrapper } = makeWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => usePageMutations(), { wrapper })
      await result.current.reorder({ id: ID_1, sortOrder: 3 })

      expect(reorderPage).toHaveBeenCalledWith({ id: ID_1, sortOrder: 3 })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['page-tree'] })
    })
  })
})
