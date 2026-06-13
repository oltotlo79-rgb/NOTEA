'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listTrashedPages } from '@/lib/actions/pages'

type TrashedPageItem = {
  id: string
  title: string
  icon: string | null
  trashed_at: string
}

type TrashedPagesResult = {
  items: TrashedPageItem[]
  nextCursor: string | undefined
  isLoading: boolean
  error: Error | null
  loadMore: () => void
  hasMore: boolean
}

export function useTrashedPages(): TrashedPagesResult {
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allItems, setAllItems] = useState<TrashedPageItem[]>([])
  const [lastCursor, setLastCursor] = useState<string | undefined>(undefined)

  const { isLoading, error } = useQuery({
    queryKey: ['trashed-pages', cursor],
    queryFn: async () => {
      const result = await listTrashedPages(cursor)
      if (result.error) throw new Error(result.error)

      if (cursor === undefined) {
        setAllItems(result.data)
      } else {
        setAllItems((prev) => [...prev, ...result.data])
      }
      setLastCursor(result.nextCursor)
      return result
    },
    staleTime: 0,
  })

  const loadMore = () => {
    if (lastCursor) setCursor(lastCursor)
  }

  return {
    items: allItems,
    nextCursor: lastCursor,
    isLoading,
    error: error instanceof Error ? error : null,
    loadMore,
    hasMore: !!lastCursor,
  }
}
