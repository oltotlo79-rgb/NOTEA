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
      exclude: ['components/ui/**', 'types/database.ts'],
      thresholds: { branches: 80, functions: 85, lines: 85, statements: 85 },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
