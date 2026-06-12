import { expect, test } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

// supabase/seed.sql で投入されるテストユーザー
const E2E_EMAIL = 'e2e@example.com'
const E2E_PASSWORD = 'Password123'

test('未認証で /pages にアクセスすると /login へリダイレクトされる', async ({ page }) => {
  await page.goto('/pages')
  await page.waitForURL(/\/login\?redirectTo=/)
  await expect(page.getByLabel('メールアドレス')).toBeVisible()
})

test('ログイン → /pages 表示 → ログアウト', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByLabel('メールアドレス').fill(E2E_EMAIL)
  await page.getByLabel('パスワード').fill(E2E_PASSWORD)
  await clickAndWaitForUrl(page, page.getByRole('button', { name: 'ログイン', exact: true }), /\/pages/)
  await expect(page.getByText(E2E_EMAIL)).toBeVisible()
  await clickAndWaitForUrl(page, page.getByRole('button', { name: 'ログアウト' }), /\/login/)
})

test('誤ったパスワードでエラーが表示される', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByLabel('メールアドレス').fill(E2E_EMAIL)
  await page.getByLabel('パスワード').fill('wrong-password-1')
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  // dev モードは Next.js Dev Tools も role=alert を持つためフォーム内にスコープする
  await expect(page.locator('form').getByRole('alert')).toContainText('正しくありません')
})

test('新規登録すると確認メール案内ページが表示される', async ({ page }) => {
  await page.goto('/register')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByLabel('メールアドレス').fill(`e2e+${Date.now()}@example.com`)
  await page.getByLabel('パスワード').fill('Password123')
  await clickAndWaitForUrl(
    page,
    page.getByRole('button', { name: '登録する' }),
    /\/register\/verify-email-sent/
  )
  await expect(page.getByText('確認メールを送信しました')).toBeVisible()
})

test('ログイン済みで /login にアクセスすると /pages へリダイレクトされる', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByLabel('メールアドレス').fill(E2E_EMAIL)
  await page.getByLabel('パスワード').fill(E2E_PASSWORD)
  await clickAndWaitForUrl(page, page.getByRole('button', { name: 'ログイン', exact: true }), /\/pages/)
  await page.goto('/login')
  await page.waitForURL(/\/pages/)
})
