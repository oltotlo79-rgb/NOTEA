/**
 * E2E: 設定ページのテスト
 * - プロフィール表示名編集→保存→反映
 * - 使用量表示（progressbar）
 * - テーマ切替（ライト/ダーク/システム）
 */

import { expect, test } from '@playwright/test'
import { loginForSettings } from './helpers/auth'
import { cleanupSeedUserPages } from './helpers/db'

test.beforeEach(async () => {
  await cleanupSeedUserPages()
})

// =====================
// プロフィール設定
// =====================

test('設定ページのプロフィールリンクが表示される', async ({ page }) => {
  await loginForSettings(page, '/settings/profile')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  // 設定ナビが存在する
  const nav = page.getByTestId('settings-nav')
  await expect(nav).toBeVisible({ timeout: 15000 })

  // プロフィールリンクが active（aria-current="page"）
  const profileLink = page.getByTestId('settings-nav-profile')
  await expect(profileLink).toHaveAttribute('aria-current', 'page', { timeout: 10000 })
})

test('プロフィール設定: 表示名入力欄が表示される', async ({ page }) => {
  await loginForSettings(page, '/settings/profile')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  const nameInput = page.getByTestId('profile-display-name-input')
  await expect(nameInput).toBeVisible({ timeout: 15000 })
})

test('プロフィール設定: 空白入力でバリデーションエラーが表示される', async ({ page }) => {
  await loginForSettings(page, '/settings/profile')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  const nameInput = page.getByTestId('profile-display-name-input')
  await expect(nameInput).toBeVisible({ timeout: 15000 })

  // 入力を空にして保存
  await nameInput.fill('')
  await page.getByTestId('profile-save-button').click()

  await expect(page.getByText('表示名を入力してください')).toBeVisible({ timeout: 10000 })
})

test('プロフィール設定: 表示名を保存して成功メッセージが表示される', async ({ page }) => {
  await loginForSettings(page, '/settings/profile')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  const nameInput = page.getByTestId('profile-display-name-input')
  await expect(nameInput).toBeVisible({ timeout: 15000 })

  const newName = `E2E テストユーザー ${Date.now()}`
  await nameInput.fill(newName)
  await page.getByTestId('profile-save-button').click()

  // 成功メッセージが表示される
  await expect(page.getByText('プロフィールを保存しました')).toBeVisible({ timeout: 15000 })
})

// =====================
// 使用量表示
// =====================

test('使用量ページ: ページ数メーターが表示される', async ({ page }) => {
  await loginForSettings(page, '/settings/usage')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  const meter = page.getByTestId('usage-pages-meter')
  await expect(meter).toBeVisible({ timeout: 15000 })
})

test('使用量ページ: ストレージメーターが表示される', async ({ page }) => {
  await loginForSettings(page, '/settings/usage')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  const meter = page.getByTestId('usage-storage-meter')
  await expect(meter).toBeVisible({ timeout: 15000 })
})

test('使用量ページ: プログレスバーが role="progressbar" を持つ', async ({ page }) => {
  await loginForSettings(page, '/settings/usage')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  await expect(page.getByTestId('usage-pages-meter')).toBeVisible({ timeout: 15000 })

  // progressbar ARIA が存在する
  const progressbars = page.locator('[role="progressbar"]')
  const count = await progressbars.count()
  expect(count).toBeGreaterThan(0)
})

// =====================
// テーマ切替
// =====================

test('外観設定: テーマ選択ボタンが表示される', async ({ page }) => {
  await loginForSettings(page, '/settings/appearance')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  await expect(page.getByTestId('theme-light')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('theme-dark')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('theme-system')).toBeVisible({ timeout: 15000 })
})

test('外観設定: ダークテーマを選択すると html に dark クラスが付く', async ({ page }) => {
  await loginForSettings(page, '/settings/appearance')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  await expect(page.getByTestId('theme-dark')).toBeVisible({ timeout: 15000 })
  await page.getByTestId('theme-dark').click()

  // next-themes が html 要素に "dark" クラスを付与するまで待つ
  await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 })
})

test('外観設定: ライトテーマを選択すると html から dark クラスが除かれる', async ({ page }) => {
  await loginForSettings(page, '/settings/appearance')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  await expect(page.getByTestId('theme-dark')).toBeVisible({ timeout: 15000 })

  // まずダークにしてから
  await page.getByTestId('theme-dark').click()
  await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 })

  // ライトに切り替え
  await page.getByTestId('theme-light').click()
  await expect(page.locator('html')).not.toHaveClass(/dark/, { timeout: 5000 })
})

test('外観設定: テーマ選択が radiogroup になっている', async ({ page }) => {
  await loginForSettings(page, '/settings/appearance')
  await page.waitForLoadState('domcontentloaded').catch(() => {})

  await expect(page.getByTestId('theme-light')).toBeVisible({ timeout: 15000 })

  const radiogroup = page.getByRole('radiogroup', { name: 'テーマを選択' })
  await expect(radiogroup).toBeVisible()
})
