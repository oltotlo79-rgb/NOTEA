'use client'

import { PageError } from '@/components/common/PageError'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return <PageError error={error} reset={reset} title="設定の読み込みに失敗しました" />
}
