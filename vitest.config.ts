import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'istanbul',
      include: ['lib/**', 'types/**', 'components/**', 'hooks/**'],
      // components/ui = shadcn 生成物 / database.ts = 自動生成 /
      // lib/supabase = Next.js ランタイム（cookies/Edge）接着層で単体テスト不能。E2E が検証する
      exclude: ['components/ui/**', 'types/database.ts', 'lib/supabase/**'],
      thresholds: { branches: 80, functions: 85, lines: 85, statements: 85 },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
