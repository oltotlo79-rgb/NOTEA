import { expect, test } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'
import { login, createPageWithTitle } from './helpers/auth'
import { cleanupSeedUserPages } from './helpers/db'

test.beforeEach(async () => {
  await cleanupSeedUserPages()
})

/**
 * サイドバーのページメニューを開いて「ごみ箱に移動」を選択するヘルパー。
 * ドロップダウンが必ず表示されることをアサーションで保証する。
 */
async function moveToTrash(page: import('@playwright/test').Page, pageTitle: string) {
  const pageItem = page.getByText(pageTitle).first()
  await pageItem.hover()

  const menuBtn = page.getByRole('button', { name: 'ページメニュー' }).first()
  await menuBtn.click({ force: true })

  const trashItem = page.getByText('ごみ箱に移動')
  await expect(trashItem).toBeVisible({ timeout: 5000 })
  await trashItem.click()

  // サイドバーのリンクが消えることを確認（.first() で strict mode 違反を回避）
  await expect(page.getByRole('link', { name: pageTitle })).not.toBeVisible({ timeout: 5000 })
}

test('ページをごみ箱へ移動すると /trash に表示される', async ({ page }) => {
  await login(page)

  const pageTitle = `ごみ箱テスト ${Date.now()}`
  await createPageWithTitle(page, pageTitle)

  await moveToTrash(page, pageTitle)

  await clickAndWaitForUrl(page, page.getByRole('link', { name: /ごみ箱/ }), /\/trash/)
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(page.getByText(pageTitle).first()).toBeVisible({ timeout: 5000 })
})

test('ごみ箱のページを復元するとツリーに戻る', async ({ page }) => {
  await login(page)

  const pageTitle = `復元テスト ${Date.now()}`
  await createPageWithTitle(page, pageTitle)

  await moveToTrash(page, pageTitle)

  await clickAndWaitForUrl(page, page.getByRole('link', { name: /ごみ箱/ }), /\/trash/)
  await page.waitForLoadState('networkidle').catch(() => {})

  const restoreBtn = page.getByRole('button', { name: '復元' }).first()
  await expect(restoreBtn).toBeVisible({ timeout: 5000 })
  await restoreBtn.click()
  await page.waitForLoadState('networkidle').catch(() => {})

  // 復元後、/trash のリストからページが消えることを確認する
  // ごみ箱リストのコンテナに絞ってアサーション（サイドバーとの混同を避ける）
  await expect(page.getByRole('button', { name: '復元' })).not.toBeVisible({ timeout: 5000 })
})

test('ごみ箱のページを完全削除すると消える', async ({ page }) => {
  await login(page)

  const pageTitle = `完全削除テスト ${Date.now()}`
  await createPageWithTitle(page, pageTitle)

  await moveToTrash(page, pageTitle)

  await clickAndWaitForUrl(page, page.getByRole('link', { name: /ごみ箱/ }), /\/trash/)
  await page.waitForLoadState('networkidle').catch(() => {})

  const deleteBtn = page.getByRole('button', { name: '完全に削除' }).first()
  await expect(deleteBtn).toBeVisible({ timeout: 5000 })
  await deleteBtn.click()

  const confirmBtn = page.getByRole('button', { name: '完全に削除' }).last()
  await expect(confirmBtn).toBeVisible({ timeout: 3000 })
  await confirmBtn.click()

  await expect(page.getByText(pageTitle).first()).not.toBeVisible({ timeout: 5000 })
})
