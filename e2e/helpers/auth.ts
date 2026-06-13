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
 *
 * Server Action → revalidatePath → router.push の完了を確実に捕捉するため、
 * クリック前に networkidle で pending fetch を全て終わらせてからボタンを押す。
 * クリック後も waitForURL を atomic に仕掛けてから click するパターンで
 * navigation を取り逃がさないようにする。
 */
export async function createPage(page: Page): Promise<string> {
  const createBtn = page.getByRole('button', { name: '新規ページを作成' })
  await expect(createBtn).toBeEnabled({ timeout: 10000 })

  // クリック前に pending な fetch/revalidation を全て終わらせて安定させる。
  // Server Action 完了直後に router.push が呼ばれるため、前の操作が残っていると
  // waitForFunction が URL 変化を取り逃がす場合がある。
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(createBtn).toBeEnabled({ timeout: 5000 })

  const currentUrl = page.url()

  // waitForURL を先に仕掛けてから click する atomic パターン。
  // click() の後から waitForURL を登録すると navigation 完了を取り逃がす場合がある。
  // router.push() + router.refresh() の二段階 navigation で 'load' が遅延するため
  // URL 変化の commit のみを待ち、その後 networkidle で安定させる
  await Promise.all([
    createBtn.click(),
    page.waitForURL(
      (url) => /\/pages\/[0-9a-f-]+/.test(url.pathname) && url.href !== currentUrl,
      { timeout: 60000, waitUntil: 'commit' }
    ),
  ])
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
