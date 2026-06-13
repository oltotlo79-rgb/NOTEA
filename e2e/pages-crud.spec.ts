import { expect, test } from '@playwright/test'
import { login, createPage, createPageWithTitle } from './helpers/auth'
import { cleanupSeedUserPages } from './helpers/db'

test.beforeEach(async () => {
  await cleanupSeedUserPages()
})

test('ページを新規作成して /pages/[id] に遷移する', async ({ page }) => {
  await login(page)

  const id = await createPage(page)

  await expect(page).toHaveURL(new RegExp(`/pages/${id}`))
})

test('ページを作成してタイトルを編集し、サイドバーに反映される', async ({ page }) => {
  await login(page)

  const uniqueTitle = `E2E テストページ ${Date.now()}`
  await createPageWithTitle(page, uniqueTitle)

  await expect(page.getByText(uniqueTitle).first()).toBeVisible({ timeout: 5000 })
})

test('「まだページがありません」状態で作成ボタンをクリックするとページが作成される', async ({
  page,
}) => {
  await login(page)

  // per-test クリアにより必ず空状態から始まる
  await expect(page.getByText('まだページがありません')).toBeVisible({ timeout: 5000 })

  const firstCreateBtn = page.getByRole('button', { name: '最初のページを作成' })
  await expect(firstCreateBtn).toBeEnabled({ timeout: 5000 })
  await firstCreateBtn.click()
  await page.waitForURL(/\/pages\/[0-9a-f-]+/, { timeout: 10000 })
  await expect(page).toHaveURL(/\/pages\/[0-9a-f-]+/)
})
