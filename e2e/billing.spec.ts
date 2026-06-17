import { expect, test } from '@playwright/test'
import { loginForSettings } from './helpers/auth'

// Stripe 実鍵が無くても /settings/plan の描画（RSC + PlanView）は検証できる。
// 実際の Checkout 遷移は鍵設定後に手動確認する（決済は外部依存のため E2E 対象外）。
test('プラン設定画面に無料プランのアップグレード導線が表示される', async ({ page }) => {
  await loginForSettings(page, '/settings/plan')

  await expect(page.getByRole('heading', { name: 'プラン', exact: true })).toBeVisible({
    timeout: 10000,
  })
  await expect(page.getByText('月額プラン')).toBeVisible()
  await expect(page.getByText('年額プラン')).toBeVisible()
  await expect(page.getByRole('button', { name: 'このプランにする' }).first()).toBeVisible()
})

test('設定ナビからプラン画面へ遷移できる', async ({ page }) => {
  await loginForSettings(page, '/settings/usage')

  await page.getByTestId('settings-nav-plan').click()
  await expect(page).toHaveURL(/\/settings\/plan/, { timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'プラン', exact: true })).toBeVisible({
    timeout: 10000,
  })
})
