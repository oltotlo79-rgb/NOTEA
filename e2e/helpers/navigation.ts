import type { Locator, Page } from '@playwright/test'

type WaitForURLOptions = Parameters<Page['waitForURL']>[1]

// click → waitForURL を順に書くと navigation 完了を取り逃がして flake するため atomic に待つ。
// router.push() + router.refresh() を使うコンポーネントでは 'load' イベントが遅延する場合があるため、
// waitUntil オプションを呼び出し側で切り替えられるようにする。
export async function clickAndWaitForUrl(
  page: Page,
  locator: Locator,
  url: string | RegExp,
  options?: WaitForURLOptions
) {
  await Promise.all([page.waitForURL(url, options), locator.click()])
}
