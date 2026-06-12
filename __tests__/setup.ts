import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest は globals なし運用のため RTL の自動 cleanup が効かない。明示的に実行する
afterEach(() => {
  cleanup()
})
