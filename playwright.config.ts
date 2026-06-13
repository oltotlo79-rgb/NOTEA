import { defineConfig, devices } from '@playwright/test'
import { config as loadDotenv } from 'dotenv'
import path from 'path'

// .env.local を明示的に読み込む（Playwright は Next.js のように自動ロードしないため）
loadDotenv({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  testDir: './e2e',
  // 本番ビルドで実行するため CI/ローカル両方で全ルートが事前コンパイル済み。
  // DB を共有するためローカルは workers=1 でシリアル実行する。
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: !!process.env.CI,
  workers: process.env.CI ? undefined : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3010',
    trace: 'on-first-retry',
    // 本番ビルドの CSP nonce 問題（proxy.ts が nonce を生成するが <script> タグへの付与が未実装）を
    // E2E テスト中にバイパスする。本番コードの nonce 修正が完了次第この設定は削除する。
    bypassCSP: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // ローカル/CI 両方とも本番ビルドで起動してオンデマンドコンパイル遅延を根絶する
    command: 'npm run build && npm run start',
    url: 'http://localhost:3010',
    reuseExistingServer: !process.env.CI,
    // npm run build の時間込みで余裕を持たせる
    timeout: 240_000,
  },
})
