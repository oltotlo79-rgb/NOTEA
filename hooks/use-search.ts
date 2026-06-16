'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchPages, type SearchResult } from '@/lib/actions/search'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants/limits'

type UseSearchResult = {
  query: string
  setQuery: (value: string) => void
  debouncedQuery: string
  results: SearchResult[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  loadMore: () => void
  hasMore: boolean
}

/**
 * 検索ボックスの状態と結果を管理する。
 * 入力は SEARCH_DEBOUNCE_MS で debounce し、クエリ変更時はカーソルと累積結果をリセットする。
 */
export function useSearch(): UseSearchResult {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allResults, setAllResults] = useState<SearchResult[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = query.trim()
      setDebouncedQuery(trimmed)
      // クエリ変更で先頭ページから取り直す
      setCursor(undefined)
      setAllResults([])
      setNextCursor(undefined)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const enabled = debouncedQuery.length > 0

  const { isLoading, isFetching, error } = useQuery({
    queryKey: ['search', debouncedQuery, cursor],
    enabled,
    queryFn: async () => {
      const result = await searchPages(debouncedQuery, cursor)
      if (result.error) throw new Error(result.error)

      if (cursor === undefined) {
        setAllResults(result.data)
      } else {
        setAllResults((prev) => [...prev, ...result.data])
      }
      setNextCursor(result.nextCursor)
      return result
    },
    staleTime: 0,
  })

  const loadMore = () => {
    if (nextCursor) setCursor(nextCursor)
  }

  return {
    query,
    setQuery,
    debouncedQuery,
    results: enabled ? allResults : [],
    isLoading: enabled && isLoading,
    isFetching: enabled && isFetching,
    error: error instanceof Error ? error : null,
    loadMore,
    hasMore: !!nextCursor,
  }
}
