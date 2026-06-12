import type { Locator, Page } from '@playwright/test'

// click → waitForURL を順に書くと navigation 完了を取り逃がして flake するため atomic に待つ
export async function clickAndWaitForUrl(page: Page, locator: Locator, url: string | RegExp) {
  await Promise.all([page.waitForURL(url), locator.click()])
}
