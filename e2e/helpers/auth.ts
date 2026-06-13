import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const E2E_EMAIL = 'e2e@example.com'
export const E2E_PASSWORD = 'Password123'

/**
 * ログインして UI が安定するまで待つ。
 *
 * seed ユーザーはページ 0 件のため /pages は空状態になる。
 * ログイン直後の /pages → /pages/[id] への自動リダイレクトや
 * hydration 完了前のクリックを防ぐため、以下を順に待つ:
 *   1. ログインボタンをクリックして /pages または /pages/[id] へ URL が変わるまで
 *   2. networkidle（SSR + React hydration が完了）
 *   3. サイドバーのメールアドレス表示が可視（hydration 済みの目印）
 *   4. 「新規ページを作成」ボタンが enabled（useTransition の isPending 解消）
 *   5. 「ログアウト」ボタンが enabled（SignOutButton の hydration 完了）
 *
 * router.push() + router.refresh() の組み合わせで複数回の navigation が
 * 発生する場合があるため、URL の変化を waitForFunction でポーリングする。
 */
export async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByLabel('メールアドレス').fill(E2E_EMAIL)
  await page.getByLabel('パスワード').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()

  // router.push() + router.refresh() の二段階 navigation に対応するため
  // waitForURL ではなく URL が /pages で始まるまでポーリングする
  await page.waitForFunction(() => window.location.pathname.startsWith('/pages'), {
    timeout: 90000,
  })
  await page.waitForLoadState('networkidle').catch(() => {})

  // hydration 完了の目印: サイドバーのメール表示が可視になる
  await expect(page.getByText(E2E_EMAIL)).toBeVisible({ timeout: 10000 })

  // useTransition による disabled 解除を待つ（新規ページ作成・ログアウトの両ボタン）
  const createBtn = page.getByRole('button', { name: '新規ページを作成' })
  await expect(createBtn).toBeEnabled({ timeout: 10000 })
  const signOutBtn = page.getByRole('button', { name: 'ログアウト' })
  await expect(signOutBtn).toBeEnabled({ timeout: 10000 })
}

/**
 * ページを新規作成し、新しい /pages/[id] が確定するまで待つ。
 * 返り値は作成されたページの UUID。
 *
 * 既に /pages/[uuid] にいる場合は waitForURL が即座に resolve してしまうため、
 * 現在の URL を記録してから「異なる /pages/[id]」への変化を waitForFunction でポーリングする。
 */
export async function createPage(page: Page): Promise<string> {
  const createBtn = page.getByRole('button', { name: '新規ページを作成' })
  await expect(createBtn).toBeEnabled({ timeout: 10000 })

  const currentUrl = page.url()
  await createBtn.click()

  // 現在 URL と異なる /pages/[uuid] に変わるまでポーリングする
  await page.waitForFunction(
    (current) => {
      const p = window.location.pathname
      return p.match(/\/pages\/[0-9a-f-]+/) && window.location.href !== current
    },
    currentUrl,
    { timeout: 90000 }
  )
  await page.waitForLoadState('networkidle').catch(() => {})
  const id = page.url().match(/\/pages\/([0-9a-f-]+)/)?.[1]
  if (!id) throw new Error(`createPage: could not extract page id from URL: ${page.url()}`)
  return id
}

/**
 * タイトル付きページを新規作成して、サイドバーに反映されるまで待つ。
 */
export async function createPageWithTitle(page: Page, title: string): Promise<string> {
  const id = await createPage(page)

  const titleInput = page.locator('input[placeholder="無題"]')
  await titleInput.fill(title)
  await titleInput.press('Tab')

  // タイトルが sidebar に反映されるまで待つ（autosave + re-fetch 完了）
  // .first() でルートアナウンサー (role=alert) との strict mode 違反を回避する
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 8000 })
  return id
}
