/**
 * E2E: データベース表ブロック（M9 MVP）
 * - スラッシュメニューから表を挿入 → セル入力 → 自動保存 → リロードで保持
 * - 表の内容が全文検索でヒットする
 */
import { expect, test } from '@playwright/test'
import { login, createPage } from './helpers/auth'
import { cleanupSeedUserPages } from './helpers/db'
import { clickAndWaitForUrl } from './helpers/navigation'

test.beforeEach(async () => {
  await cleanupSeedUserPages()
})

async function waitForEditorReady(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('editor-root')).toBeVisible({ timeout: 20000 })
  await page.waitForSelector('[data-testid="editor-root"] .bn-editor', { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle').catch(() => {})
}

async function insertDataTable(page: import('@playwright/test').Page) {
  const editorContent = page.locator('[data-testid="editor-root"] .bn-editor')
  await editorContent.click({ force: true }).catch(() => {})
  await page.keyboard.type('/データベース')

  const option = page.getByRole('option', { name: /データベース/ })
  await expect(option).toBeVisible({ timeout: 8000 })
  await option.click()

  await expect(page.getByTestId('data-table-block')).toBeVisible({ timeout: 8000 })
}

test('表を挿入してセル入力し、リロードしても保持される', async ({ page }) => {
  await login(page)
  await createPage(page)
  await waitForEditorReady(page)

  await insertDataTable(page)

  const value = `スイカ-${Date.now()}`
  const cell = page.getByLabel('名前 の入力').first()
  await cell.fill(value)
  await cell.blur()

  await expect(page.getByTestId('autosave-status')).toContainText('保存済み', { timeout: 15000 })

  await page.reload()
  await waitForEditorReady(page)

  await expect(page.getByTestId('data-table-block')).toBeVisible({ timeout: 10000 })
  await expect(page.getByLabel('名前 の入力').first()).toHaveValue(value, { timeout: 10000 })
})

test('表の内容が検索でヒットする', async ({ page }) => {
  await login(page)
  await createPage(page)
  await waitForEditorReady(page)

  await insertDataTable(page)

  const keyword = `表検索ワード${Date.now()}`
  const cell = page.getByLabel('名前 の入力').first()
  await cell.fill(keyword)
  await cell.blur()

  await expect(page.getByTestId('autosave-status')).toContainText('保存済み', { timeout: 15000 })

  await clickAndWaitForUrl(page, page.getByRole('link', { name: '検索', exact: true }), /\/search/)
  await page.waitForLoadState('networkidle').catch(() => {})

  await page.getByLabel('ページを検索').fill(keyword)

  // 表のセル値が content_text に抽出され、検索結果に出る
  await expect(page.getByText(new RegExp(keyword)).first()).toBeVisible({ timeout: 10000 })
})
