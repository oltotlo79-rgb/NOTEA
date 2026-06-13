'use client'

import { useQueryClient } from '@tanstack/react-query'
import {
  createPage,
  updatePageMeta,
  trashPage,
  restorePage,
  deletePagePermanently,
  movePage,
  reorderPage,
} from '@/lib/actions/pages'
import type { ActionResult } from '@/types/action-result'

export function usePageMutations() {
  const queryClient = useQueryClient()

  const invalidatePageTree = () => {
    queryClient.invalidateQueries({ queryKey: ['page-tree'] })
  }

  const invalidateTrash = () => {
    queryClient.invalidateQueries({ queryKey: ['trashed-pages'] })
  }

  const create = async (input: { parentId?: string | null; title?: string }): Promise<ActionResult<{ id: string }>> => {
    const result = await createPage(input)
    if (result.success) invalidatePageTree()
    return result
  }

  const rename = async (input: { id: string; title?: string; icon?: string | null }): Promise<ActionResult> => {
    const result = await updatePageMeta(input)
    if (result.success) invalidatePageTree()
    return result
  }

  const trash = async (id: string): Promise<ActionResult> => {
    const result = await trashPage(id)
    if (result.success) {
      invalidatePageTree()
      invalidateTrash()
    }
    return result
  }

  const restore = async (id: string): Promise<ActionResult> => {
    const result = await restorePage(id)
    if (result.success) {
      invalidatePageTree()
      invalidateTrash()
    }
    return result
  }

  const deletePermanently = async (id: string): Promise<ActionResult> => {
    const result = await deletePagePermanently(id)
    if (result.success) invalidateTrash()
    return result
  }

  const move = async (input: { id: string; newParentId: string | null }): Promise<ActionResult> => {
    const result = await movePage(input)
    if (result.success) invalidatePageTree()
    return result
  }

  const reorder = async (input: { id: string; sortOrder: number }): Promise<ActionResult> => {
    const result = await reorderPage(input)
    if (result.success) invalidatePageTree()
    return result
  }

  return { create, rename, trash, restore, deletePermanently, move, reorder }
}
