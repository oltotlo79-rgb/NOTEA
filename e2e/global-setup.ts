import { execSync } from 'child_process'
import path from 'path'
import { chromium } from '@playwright/test'
import { config as loadDotenv } from 'dotenv'

const PROJECT_ROOT = path.resolve(__dirname, '..')

// グローバルセットアップは Playwright の env auto-load より前に実行されるため明示的に読む
loadDotenv({ path: path.resolve(PROJECT_ROOT, '.env.local') })

const BASE_URL = 'http://localhost:3010'
const E2E_EMAIL = 'e2e@example.com'
const E2E_PASSWORD = 'Password123'


/**
 * 本番ビルド直後の cold-start タイムアウト解消のためにルートをウォームアップする。
 *
 * `npm run start` 直後、Next.js は各ルートを初回アクセス時にサーバー側で初期化する。
 * 複数テストが同時に初回アクセスに集中すると 60s タイムアウトに引っかかるため、
 * globalSetup でテスト開始前にすべての主要ルートを1回アクセスして初期化を済ませる。
 *
 * ウォームアップ後に supabase db reset でデータをクリーンな seed 状態に戻すことで、
 * サーバーのルート初期化は維持したまま各テストはクリーンな DB から始められる。
 *
 * ウォームアップ自体が失敗してもテストを止めない（.catch() で握りつぶし）。
 */
async function warmupRoutes(): Promise<void> {
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    })
    const page = await context.newPage()

    // /login — 認証ページの初期化
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})

    // ログイン → /pages 空状態の初期化
    await page.getByLabel('メールアドレス').fill(E2E_EMAIL).catch(() => {})
    await page.getByLabel('パスワード').fill(E2E_PASSWORD).catch(() => {})
    await page.getByRole('button', { name: 'ログイン', exact: true }).click().catch(() => {})
    await page
      .waitForFunction(() => window.location.pathname.startsWith('/pages'), { timeout: 30000 })
      .catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})

    // 新規ページ作成で /pages/[id] ルートを初期化
    const createBtn = page.getByRole('button', { name: '新規ページを作成' })
    const currentUrl = page.url()
    await createBtn.click().catch(() => {})
    await page
      .waitForFunction(
        (current) => {
          const p = window.location.pathname
          return (
            Boolean(p.match(/\/pages\/[0-9a-f-]+/)) && window.location.href !== current
          )
        },
        currentUrl,
        { timeout: 30000 }
      )
      .catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})

    // /trash ルートの初期化
    await page.goto('/trash', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})

    // /settings/ai ルートの初期化（AI BYOK テストで使用）
    await page.goto('/settings/ai', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})

    await context.close()
  } finally {
    await browser.close()
  }
}

export default async function globalSetup() {
  // ウォームアップを先に実行して主要ルートの cold-start を解消する。
  // 失敗してもテストを止めない（.catch() で握りつぶし）。
  await warmupRoutes().catch(() => {})

  // ウォームアップで作成したデータを含めて DB をクリーンな seed 状態に戻す
  // "Restarting containers" ステップが 120s を超える場合があるため 300s に延長する
  execSync('npx supabase db reset', {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
    timeout: 300000,
  })

  // supabase db reset 後にコンテナが安定するまで待つ
  await new Promise((resolve) => setTimeout(resolve, 3000))
}
