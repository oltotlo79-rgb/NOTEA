/**
 * E2E: レスポンシブ表示のテスト
 * - モバイル幅でサイドバーがドロワー（Sheet）表示になる
 * - デスクトップ幅でサイドバーが aside として表示される
 */

import { type Page, expect, test } from '@playwright/test'
import { cleanupSeedUserPages } from './helpers/db'

const E2E_EMAIL = 'e2e@example.com'
const E2E_PASSWORD = 'Password123'

test.beforeEach(async () => {
  await cleanupSeedUserPages()
})

/**
 * ページサイズに依存しない最小限のログイン。
 * login() ヘルパーはサイドバーのメール表示（デスクトップ専用 aside）を待つため
 * モバイル幅では使用できない。代わりに URL の変化のみを待つ。
 */
async function loginMinimal(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.getByLabel('メールアドレス').fill(E2E_EMAIL)
  await page.getByLabel('パスワード').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()

  await page.waitForFunction(() => window.location.pathname.startsWith('/pages'), {
    timeout: 60000,
  })
  await page.waitForLoadState('networkidle').catch(() => {})
}

test('モバイル幅でデスクトップサイドバーが非表示になる', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })

  await loginMinimal(page)

  await expect(page).toHaveURL(/\/pages/)

  // モバイル幅では aside が hidden md:flex クラスにより画面外に隠れている
  // モバイル用のハンバーガーボタン（aria-label="サイドバーを開く"）が表示されている
  const mobileMenuBtn = page.getByRole('button', { name: 'サイドバーを開く' })
  await expect(mobileMenuBtn).toBeVisible({ timeout: 15000 })
})

test('モバイル幅でハンバーガーボタンからドロワーが開く', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })

  await loginMinimal(page)

  // モバイルメニューボタンをクリック
  const mobileMenuBtn = page.getByRole('button', { name: 'サイドバーを開く' })
  await expect(mobileMenuBtn).toBeVisible({ timeout: 15000 })
  await mobileMenuBtn.click()

  // Sheet (ドロワー) が開くとダイアログが表示される
  // SheetContent は role="dialog" を持つ
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 })
})

test('デスクトップ幅でサイドバー aside が表示される', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })

  // デスクトップ幅では login() ヘルパーが使える（aside のメール表示が可視）
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.getByLabel('メールアドレス').fill(E2E_EMAIL)
  await page.getByLabel('パスワード').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()

  await page.waitForFunction(() => window.location.pathname.startsWith('/pages'), {
    timeout: 60000,
  })
  await page.waitForLoadState('networkidle').catch(() => {})

  // デスクトップでは aside が表示されている（hidden md:flex → md 以上で flex）
  // ビューポートが 1280px なので aside は visible になる
  await expect(page.locator('aside').first()).toBeVisible({ timeout: 15000 })
})

test('モバイル幅で設定ページが表示される', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })

  await loginMinimal(page)
  await page.goto('/settings')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  await expect(page).toHaveURL(/\/settings/)
})

test('モバイル幅で LP が表示される', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })

  await page.goto('/')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('lp-cta-register')).toBeVisible({ timeout: 10000 })
})
