'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

type QueryProviderProps = {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  // QueryClient をレンダリングごとに再生成しないよう useState で一度だけ生成する
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
