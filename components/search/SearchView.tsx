'use client'

import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSearch } from '@/hooks/use-search'
import { displayTitle } from '@/lib/utils/page-display'
import { ROUTES } from '@/lib/constants/routes'
import { HighlightedText } from './HighlightedText'

export function SearchView() {
  const { query, setQuery, debouncedQuery, results, isLoading, error, loadMore, hasMore } =
    useSearch()

  const hasQuery = debouncedQuery.length > 0

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 pt-8 sm:px-6">
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ページを検索"
          aria-label="ページを検索"
          className="pl-9 pr-9"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setQuery('')}
            aria-label="検索をクリア"
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="mt-4 flex-1 overflow-auto pb-8">
        <SearchResults
          hasQuery={hasQuery}
          query={debouncedQuery}
          results={results}
          isLoading={isLoading}
          error={error}
          loadMore={loadMore}
          hasMore={hasMore}
        />
      </div>
    </div>
  )
}

type SearchResultsProps = {
  hasQuery: boolean
  query: string
  results: ReturnType<typeof useSearch>['results']
  isLoading: boolean
  error: Error | null
  loadMore: () => void
  hasMore: boolean
}

function SearchResults({
  hasQuery,
  query,
  results,
  isLoading,
  error,
  loadMore,
  hasMore,
}: SearchResultsProps) {
  if (!hasQuery) {
    return (
      <p className="pt-10 text-center text-sm text-muted-foreground">
        キーワードを入力してページを検索します
      </p>
    )
  }

  if (isLoading && results.length === 0) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-4/5" />
      </div>
    )
  }

  if (error) {
    return <p className="pt-10 text-center text-sm text-destructive">検索に失敗しました</p>
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-16 text-center">
        <Search className="mb-3 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          「{query}」に一致するページはありませんでした
        </p>
      </div>
    )
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {results.map((result) => (
          <li key={result.id}>
            <Link
              href={`${ROUTES.PAGES}/${result.id}`}
              className="flex items-start gap-3 rounded-md px-2 py-3 hover:bg-muted transition-colors"
            >
              <span className="shrink-0 text-base leading-6">{result.icon ?? '📄'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  <HighlightedText text={displayTitle(result.title)} query={query} />
                </span>
                {result.snippet && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    <HighlightedText text={result.snippet} query={query} />
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={loadMore}>
            もっと見る
          </Button>
        </div>
      )}
    </>
  )
}
