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
      // components/ui = shadcn 生成物 / database.ts = 自動生成
      // EditorDynamic.tsx = next/dynamic(ssr:false) のラッパーのみ。jsdom では動作せず、
      //   実 BlockNote ロジックは持たない。E2E (editor.spec.ts) で結合として覆う。
      exclude: [
        'components/ui/**',
        'types/database.ts',
        'components/editor/EditorDynamic.tsx',
        'components/share/SharedEditorDynamic.tsx',
      ],
      thresholds: { branches: 80, functions: 85, lines: 85, statements: 85 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `import 'server-only'` を含むモジュールを vitest jsdom 環境から import 可能にするスタブ
      'server-only': path.resolve(__dirname, '__tests__/stubs/server-only.ts'),
    },
  },
})
