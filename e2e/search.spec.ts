import { expect, test } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'
import { login, createPageWithTitle } from './helpers/auth'
import { cleanupSeedUserPages } from './helpers/db'

test.beforeEach(async () => {
  await cleanupSeedUserPages()
})

/**
 * 検索ページへハードナビゲーションし、入力欄が可視になるまで待つ。
 * login 直後にサイドバーのリンクをクリックすると login の遅延 router.refresh が
 * /pages に戻すレースがあるため、page.goto で確実に /search を確定させる。
 * （サイドバーリンク経由の遷移はヒット遷移テストで別途カバーする）
 */
async function gotoSearch(page: import('@playwright/test').Page) {
  await page.goto('/search')
  await page.waitForLoadState('networkidle').catch(() => {})
  const input = page.getByLabel('ページを検索')
  await expect(input).toBeVisible({ timeout: 10000 })
  return input
}

test('サイドバーの検索リンクから作成済みページを検索してヒットし、クリックで遷移する', async ({
  page,
}) => {
  await login(page)

  const unique = Date.now()
  const pageTitle = `検索テスト ${unique}`
  const pageId = await createPageWithTitle(page, pageTitle)

  // createPageWithTitle 後は networkidle 済みで login の遅延 navigation が解消しており
  // サイドバーリンク経由の遷移が安定する
  await clickAndWaitForUrl(page, page.getByRole('link', { name: '検索', exact: true }), /\/search/)
  await page.waitForLoadState('networkidle').catch(() => {})

  await page.getByLabel('ページを検索').fill(pageTitle)

  const resultLink = page.getByRole('link', { name: new RegExp(`検索テスト ${unique}`) })
  await expect(resultLink).toBeVisible({ timeout: 10000 })

  await clickAndWaitForUrl(page, resultLink, new RegExp(`/pages/${pageId}`))
})

test('一致しないクエリでは 0 件メッセージを表示する', async ({ page }) => {
  await login(page)

  const input = await gotoSearch(page)
  await input.fill(`存在しないページ ${Date.now()}`)

  await expect(page.getByText(/一致するページはありませんでした/)).toBeVisible({ timeout: 10000 })
})

test('Ctrl+K で検索ページへ遷移する', async ({ page }) => {
  await login(page)

  await page.keyboard.press('Control+k')
  await expect(page).toHaveURL(/\/search/, { timeout: 10000 })
  await expect(page.getByLabel('ページを検索')).toBeVisible({ timeout: 10000 })
})
