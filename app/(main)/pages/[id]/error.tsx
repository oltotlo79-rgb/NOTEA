'use client'

import { PageError } from '@/components/common/PageError'

type ErrorPageProps = {
  error: Error
  reset: () => void
}

export default function PageDetailError({ error, reset }: ErrorPageProps) {
  return <PageError error={error} reset={reset} title="ページの読み込みに失敗しました" />
}
