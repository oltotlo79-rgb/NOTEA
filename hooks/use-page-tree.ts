'use client'

import { useQuery } from '@tanstack/react-query'
import { getPageTree } from '@/lib/actions/pages'
import type { PageListItem } from '@/lib/services/page-tree'

export function usePageTree() {
  return useQuery<PageListItem[], Error>({
    queryKey: ['page-tree'],
    queryFn: async () => {
      const result = await getPageTree()
      if (result.error) throw new Error(result.error)
      return result.data
    },
  })
}
