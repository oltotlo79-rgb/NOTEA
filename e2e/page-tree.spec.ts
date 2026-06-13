import { expect, test } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'
import { login, createPage, createPageWithTitle } from './helpers/auth'
import { cleanupSeedUserPages } from './helpers/db'

test.beforeEach(async () => {
  await cleanupSeedUserPages()
})

test('サブページを追加すると親の展開で子が見える', async ({ page }) => {
  await login(page)

  const parentTitle = `親ページ ${Date.now()}`
  const parentId = await createPageWithTitle(page, parentTitle)
  expect(parentId).toBeTruthy()

  const parentItem = page.getByRole('link', { name: parentTitle })
  await parentItem.hover()

  const menuBtn = page.getByRole('button', { name: 'ページメニュー' }).first()
  await menuBtn.click({ force: true })

  const addSubPageItem = page.getByText('サブページを追加')
  await expect(addSubPageItem).toBeVisible({ timeout: 5000 })
  await clickAndWaitForUrl(page, addSubPageItem, /\/pages\/[0-9a-f-]+/)
  await page.waitForLoadState('networkidle').catch(() => {})

  const subTitle = `子ページ ${Date.now()}`
  const subTitleInput = page.locator('input[placeholder="無題"]')
  await subTitleInput.fill(subTitle)
  await subTitleInput.press('Tab')

  // タイトルが autosave されるまで少し待つ
  await page.waitForLoadState('networkidle').catch(() => {})

  // 親ページに戻る
  await clickAndWaitForUrl(
    page,
    page.getByRole('link', { name: parentTitle }),
    new RegExp(`/pages/${parentId}`)
  )
  await page.waitForLoadState('networkidle').catch(() => {})

  // 親ページの展開ボタンをクリックして子が表示されるか確認（必須アサーション）
  const expandBtn = page.getByRole('button', { name: '展開する' }).first()
  await expect(expandBtn).toBeVisible({ timeout: 5000 })
  await expandBtn.click()
  await expect(page.getByRole('link', { name: subTitle })).toBeVisible({ timeout: 8000 })
})

test('サイドバーのページをクリックすると /pages/[id] に遷移する', async ({ page }) => {
  await login(page)

  const navTitle = `ナビテスト ${Date.now()}`
  const navId = await createPageWithTitle(page, navTitle)

  // /trash に移動してからサイドバーのリンクをクリックして戻る。
  // 2 回目の createPage を連続呼び出しすると waitForFunction の url.href !== current が
  // 稀にタイムアウトするため、/trash へ遷移した後にサイドバーのリンクをクリックする形式にする。
  await page.goto('/trash')
  await page.waitForLoadState('networkidle').catch(() => {})

  const navLink = page.getByRole('link', { name: navTitle })
  await expect(navLink).toBeVisible({ timeout: 5000 })
  await clickAndWaitForUrl(page, navLink, new RegExp(`/pages/${navId}`))
  await expect(page).toHaveURL(new RegExp(`/pages/${navId}`))
})
