'use client'

import { PageError } from '@/components/common/PageError'

type ErrorPageProps = {
  error: Error
  reset: () => void
}

export default function MainError({ error, reset }: ErrorPageProps) {
  return <PageError error={error} reset={reset} title="読み込みに失敗しました" />
}
