import { expect, test } from '@playwright/test'
import { login, createPageWithTitle } from './helpers/auth'
import { cleanupSeedUserPages } from './helpers/db'

const BASE_URL = 'http://localhost:3010'

test.beforeEach(async () => {
  await cleanupSeedUserPages()
})

/**
 * 共有ダイアログを開き、指定 permission のリンクを発行してトークンを返す。
 * permission='view' は 1 行目、'edit' は 2 行目の「リンクを発行」ボタン。
 * 環境ごとの NEXT_PUBLIC_APP_URL 差異を避けるため URL からトークンのみ取り出す。
 */
async function issueShare(
  page: import('@playwright/test').Page,
  permission: 'view' | 'edit'
): Promise<string> {
  await page.getByRole('button', { name: '共有' }).click()
  const label = permission === 'view' ? '閲覧のみの共有リンク' : '編集可の共有リンク'

  const createButtons = page.getByRole('button', { name: 'リンクを発行' })
  await createButtons.nth(permission === 'view' ? 0 : 1).click()

  const input = page.getByLabel(label)
  await expect(input).toBeVisible({ timeout: 10000 })
  const url = await input.inputValue()
  const token = url.split('/share/')[1] ?? ''
  expect(token.length).toBeGreaterThan(0)
  return token
}

test('閲覧リンクは匿名で読め、編集できない', async ({ page, browser }) => {
  await login(page)
  const title = `共有閲覧 ${Date.now()}`
  await createPageWithTitle(page, title)

  const token = await issueShare(page, 'view')

  const ctx = await browser.newContext()
  const anon = await ctx.newPage()
  await anon.goto(`${BASE_URL}/share/${token}`)
  await anon.waitForLoadState('networkidle').catch(() => {})

  await expect(anon.getByRole('heading', { name: title })).toBeVisible({ timeout: 10000 })
  // 編集リンクではないのでログイン案内は出ない
  await expect(anon.getByText(/編集するには/)).not.toBeVisible()
  // 読取専用（contenteditable=false）
  const editable = anon.locator('[data-testid="shared-editor-root"] [contenteditable]').first()
  await expect(editable).toHaveAttribute('contenteditable', 'false', { timeout: 10000 })

  await ctx.close()
})

test('編集リンクは未ログインだと閲覧のみ＋ログイン案内を表示する', async ({ page, browser }) => {
  await login(page)
  const title = `共有編集 ${Date.now()}`
  await createPageWithTitle(page, title)

  const token = await issueShare(page, 'edit')

  const ctx = await browser.newContext()
  const anon = await ctx.newPage()
  await anon.goto(`${BASE_URL}/share/${token}`)
  await anon.waitForLoadState('networkidle').catch(() => {})

  await expect(anon.getByText(/編集するには/)).toBeVisible({ timeout: 10000 })
  const editable = anon.locator('[data-testid="shared-editor-root"] [contenteditable]').first()
  await expect(editable).toHaveAttribute('contenteditable', 'false', { timeout: 10000 })

  await ctx.close()
})

test('編集リンクはログインユーザーなら編集できる', async ({ page }) => {
  await login(page)
  const title = `共有編集ログイン ${Date.now()}`
  await createPageWithTitle(page, title)

  const token = await issueShare(page, 'edit')

  // 同一（ログイン済み）ユーザーで共有編集リンクを開く
  await page.goto(`${BASE_URL}/share/${token}`)
  await page.waitForLoadState('networkidle').catch(() => {})

  await expect(page.getByText('共有編集中')).toBeVisible({ timeout: 10000 })
  const editable = page.locator('[data-testid="shared-editor-root"] [contenteditable]').first()
  await expect(editable).toHaveAttribute('contenteditable', 'true', { timeout: 10000 })
})

test('失効したリンクは 404 になる', async ({ page, browser }) => {
  await login(page)
  const title = `共有失効 ${Date.now()}`
  await createPageWithTitle(page, title)

  const token = await issueShare(page, 'view')

  // 失効
  await page.getByRole('button', { name: '失効' }).click()
  await expect(page.getByRole('button', { name: 'リンクを発行' }).first()).toBeVisible({
    timeout: 10000,
  })

  const ctx = await browser.newContext()
  const anon = await ctx.newPage()
  await anon.goto(`${BASE_URL}/share/${token}`)
  await anon.waitForLoadState('networkidle').catch(() => {})

  await expect(anon.getByText('共有リンクが見つかりません')).toBeVisible({ timeout: 10000 })

  await ctx.close()
})
