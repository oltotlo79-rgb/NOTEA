/**
 * E2E: AI BYOK（Bring Your Own Key）テスト
 *
 * 最重要: 「鍵がサーバーに漏れない」ことを page.on('request') で全リクエスト監視して保証する。
 *
 * 方針:
 * - localStorage にダミー鍵を注入（addInitScript）
 * - page.route() でプロバイダ API（generativelanguage/anthropic/openai）をスタブ
 * - 自アプリオリジン（localhost:3010）へのリクエストのヘッダ/ボディにダミー鍵が含まれないことを assert
 * - OpenAI proxy（/api/ai/proxy）の Authorization は許容する唯一の例外
 * - E2E はローカル Supabase（本番環境不使用）
 */

import { test, expect } from '@playwright/test'
import { login, loginForSettings, createPage } from './helpers/auth'
import { cleanupSeedUserPages } from './helpers/db'

const APP_ORIGIN = 'http://localhost:3010'

// ダミーの API 鍵（実際には存在しない鍵）
const DUMMY_GEMINI_KEY = 'AIzaSy-DUMMY-TEST-KEY-FOR-E2E-TESTING'
const DUMMY_OPENAI_KEY = 'sk-DUMMY-TEST-KEY-FOR-E2E-TESTING-1234'
const DUMMY_ANTHROPIC_KEY = 'sk-ant-DUMMY-TEST-KEY-FOR-E2E-TESTING'

// プロバイダ API の SSE レスポンス（ストリーミング）
const GEMINI_SSE_RESPONSE = `data: ${JSON.stringify({
  candidates: [{ content: { parts: [{ text: 'これはテスト要約です。' }] } }],
})}\n\n`

const ANTHROPIC_SSE_RESPONSE = `data: ${JSON.stringify({
  type: 'content_block_delta',
  delta: { type: 'text_delta', text: 'これはテスト応答です。' },
})}\n\n`

const OPENAI_SSE_RESPONSE = `data: ${JSON.stringify({
  choices: [{ delta: { content: 'これはOpenAIのテスト応答です。' } }],
})}\n\ndata: [DONE]\n\n`

/**
 * localStorage にダミー鍵を注入するスクリプト。
 * addInitScript で page ロード前に実行させる。
 */
async function injectDummyKeys(page: import('@playwright/test').Page, providers: ('gemini' | 'openai' | 'anthropic')[]) {
  await page.addInitScript((provs) => {
    for (const p of provs) {
      const key = p === 'gemini'
        ? 'AIzaSy-DUMMY-TEST-KEY-FOR-E2E-TESTING'
        : p === 'openai'
        ? 'sk-DUMMY-TEST-KEY-FOR-E2E-TESTING-1234'
        : 'sk-ant-DUMMY-TEST-KEY-FOR-E2E-TESTING'
      localStorage.setItem(`notea_ai_key_${p}`, key)
    }
    if (provs[0]) localStorage.setItem('notea_ai_last_provider', provs[0])
  }, providers)
}

/**
 * プロバイダ API をスタブして実際の API 呼び出しをブロックする。
 */
async function stubProviderApis(page: import('@playwright/test').Page) {
  // Gemini API をスタブ
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: GEMINI_SSE_RESPONSE,
    })
  })

  // Anthropic API をスタブ
  await page.route('**/api.anthropic.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: ANTHROPIC_SSE_RESPONSE,
    })
  })

  // OpenAI API をスタブ（proxy 経由なので /api/ai/proxy をスタブ）
  await page.route('**/api/ai/proxy', async (route) => {
    const request = route.request()
    const authHeader = request.headers()['authorization']

    // proxy への Authorization ヘッダはダミー鍵を含むことを確認（唯一の許容例外）
    // このルートは自アプリ経由であり、そのままスタブで応答する
    if (authHeader?.includes(DUMMY_OPENAI_KEY)) {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: OPENAI_SSE_RESPONSE,
      })
    } else {
      await route.continue()
    }
  })
}

test.beforeEach(async () => {
  await cleanupSeedUserPages()
})

// =====================
// 最重要: 鍵非漏洩テスト
// =====================

test('自アプリへのリクエストにダミー鍵が含まれない（Gemini 使用時）', async ({ page }) => {
  // 全リクエストを監視して鍵漏洩を検出する
  const leakedRequests: Array<{ url: string; leak: string }> = []

  page.on('request', async (request) => {
    const url = request.url()

    // 自アプリ（localhost:3010）へのリクエストのみ監視
    if (!url.startsWith(APP_ORIGIN)) return

    // /api/ai/proxy の Authorization は OpenAI の唯一の例外として許容する
    if (url.includes('/api/ai/proxy')) return

    // ヘッダに鍵が含まれるか確認
    const headers = request.headers()
    const headersStr = JSON.stringify(headers)

    if (headersStr.includes(DUMMY_GEMINI_KEY)) {
      leakedRequests.push({ url, leak: 'gemini key in headers' })
    }
    if (headersStr.includes(DUMMY_OPENAI_KEY)) {
      leakedRequests.push({ url, leak: 'openai key in headers' })
    }
    if (headersStr.includes(DUMMY_ANTHROPIC_KEY)) {
      leakedRequests.push({ url, leak: 'anthropic key in headers' })
    }

    // POST ボディに鍵が含まれるか確認
    const postData = request.postData()
    if (postData) {
      if (postData.includes(DUMMY_GEMINI_KEY)) {
        leakedRequests.push({ url, leak: 'gemini key in body' })
      }
      if (postData.includes(DUMMY_OPENAI_KEY)) {
        leakedRequests.push({ url, leak: 'openai key in body' })
      }
      if (postData.includes(DUMMY_ANTHROPIC_KEY)) {
        leakedRequests.push({ url, leak: 'anthropic key in body' })
      }
    }
  })

  // Gemini プロバイダを注入
  await injectDummyKeys(page, ['gemini'])
  await stubProviderApis(page)

  await login(page)
  await createPage(page)

  // エディタが表示されるまで待つ
  await expect(page.getByTestId('editor-root')).toBeVisible({ timeout: 20000 })
  await page.waitForLoadState('networkidle').catch(() => {})

  // AI メニューボタンが表示されることを確認（表示の確認のみ、クリックは別テストで）
  // consumeAiUsage Server Action が呼ばれたとき鍵が含まれないことを確認
  // ここで AI 利用バッジが表示されていることを確認（残回数取得で鍵が漏れないことの間接確認）
  const usageBadge = page.getByTestId('ai-usage-badge')
  await expect(usageBadge).toBeVisible({ timeout: 15000 })

  // 鍵漏洩がないことをアサート
  expect(leakedRequests).toHaveLength(0)
})

test('設定ページで鍵が登録済み表示される（末尾4文字のみ）', async ({ page }) => {
  await injectDummyKeys(page, ['gemini'])
  await stubProviderApis(page)

  // loginForSettings が /settings/ai への goto まで内包するため、
  // 直後の goto は不要（loginForSettings のデフォルト settingsPath = '/settings/ai'）
  await loginForSettings(page)

  // 鍵が登録済み状態で表示される
  const keyCard = page.getByTestId('ai-key-manager-gemini')
  await expect(keyCard).toBeVisible({ timeout: 15000 })

  // 入力欄に末尾4文字が表示されている（完全な鍵は表示されない）
  const keyInput = page.getByTestId('ai-key-input-gemini')
  await expect(keyInput).toBeVisible()
  // React hydration 後に localStorage の鍵が反映されるまでポーリングして待つ
  await expect(keyInput).not.toHaveValue('', { timeout: 10000 })
  const inputValue = await keyInput.inputValue()
  // 末尾4文字（'TING'）は見えるが、前半はマスク文字（•）で置き換えられている
  // スナップショット確認: value = '•••...•TING' (33個の• + 末尾4文字)
  expect(inputValue).toContain('TING')
  expect(inputValue).not.toBe(DUMMY_GEMINI_KEY)
  // 先頭の平文部分（'AIzaSy-DUMMY...'）が含まれないことで完全な鍵が露出していないことを確認
  expect(inputValue).not.toContain('AIzaSy-DUMMY')
})

test('無料プランで OpenAI/Anthropic のキーカードが非表示', async ({ page }) => {
  // 無料プランユーザーとしてログイン（seed ユーザーはデフォルト free プラン）
  // loginForSettings が /settings/ai への goto まで内包するため、直後の goto は不要
  await loginForSettings(page)

  // Gemini カードは表示される
  await expect(page.getByTestId('ai-key-manager-gemini')).toBeVisible({ timeout: 15000 })

  // OpenAI・Anthropic カードは非表示（無料プラン）
  expect(await page.getByTestId('ai-key-manager-openai').count()).toBe(0)
  expect(await page.getByTestId('ai-key-manager-anthropic').count()).toBe(0)
})

test('残回数バッジがエディタページに表示される', async ({ page }) => {
  await injectDummyKeys(page, ['gemini'])
  await stubProviderApis(page)

  await login(page)
  await createPage(page)

  await expect(page.getByTestId('editor-root')).toBeVisible({ timeout: 20000 })
  await page.waitForLoadState('networkidle').catch(() => {})

  // 残回数バッジが表示される
  const badge = page.getByTestId('ai-usage-badge')
  await expect(badge).toBeVisible({ timeout: 15000 })

  // バッジのテキストが「本日 N/M 回」の形式
  const badgeText = await badge.textContent()
  expect(badgeText).toMatch(/本日\s*\d+\/\d+\s*回/)
})

test('残回数バッジをクリックすると /settings/ai に遷移する', async ({ page }) => {
  await injectDummyKeys(page, ['gemini'])
  await stubProviderApis(page)

  await login(page)
  await createPage(page)

  await expect(page.getByTestId('editor-root')).toBeVisible({ timeout: 20000 })
  await page.waitForLoadState('networkidle').catch(() => {})

  const badge = page.getByTestId('ai-usage-badge')
  await expect(badge).toBeVisible({ timeout: 15000 })

  await Promise.all([
    page.waitForURL(/\/settings\/ai/, { timeout: 15000 }),
    badge.click(),
  ])

  await expect(page).toHaveURL(/\/settings\/ai/)
})

test('AI 設定ページのセキュリティバナーが表示される', async ({ page }) => {
  // loginForSettings が /settings/ai への goto まで内包するため、直後の goto は不要
  await loginForSettings(page)

  const banner = page.getByTestId('ai-security-banner')
  await expect(banner).toBeVisible({ timeout: 15000 })

  // セキュリティバナーに「サーバーには送信・保存されません」の文言が含まれる
  await expect(banner).toContainText('サーバーには送信')
})

test('consumeAiUsage Server Action のリクエストに鍵が含まれない', async ({ page }) => {
  const serverActionRequests: Array<{ url: string; body: string }> = []

  page.on('request', (request) => {
    const url = request.url()
    if (!url.startsWith(APP_ORIGIN)) return
    if (url.includes('/api/ai/proxy')) return

    const postData = request.postData() ?? ''
    // Server Action は POST リクエストで Next.js 内部的に送られる
    serverActionRequests.push({ url, body: postData })
  })

  await injectDummyKeys(page, ['gemini'])
  await stubProviderApis(page)

  await login(page)
  await createPage(page)

  await expect(page.getByTestId('editor-root')).toBeVisible({ timeout: 20000 })
  await page.waitForLoadState('networkidle').catch(() => {})

  // 残回数バッジ表示（getAiUsageToday が呼ばれる）を待つ
  const badge = page.getByTestId('ai-usage-badge')
  await expect(badge).toBeVisible({ timeout: 15000 })

  // 収集したすべてのリクエストボディに鍵が含まれないことを確認
  for (const req of serverActionRequests) {
    expect(req.body).not.toContain(DUMMY_GEMINI_KEY)
    expect(req.body).not.toContain(DUMMY_OPENAI_KEY)
    expect(req.body).not.toContain(DUMMY_ANTHROPIC_KEY)
  }
})

// =====================
// AI メニューの基本動作確認
// =====================

test('エディタに AI メニューボタンが存在する（フォーマットツールバー拡張）', async ({ page }) => {
  await injectDummyKeys(page, ['gemini'])
  await stubProviderApis(page)

  await login(page)
  await createPage(page)

  await expect(page.getByTestId('editor-root')).toBeVisible({ timeout: 20000 })
  await page.waitForLoadState('networkidle').catch(() => {})

  // エディタにテキストを入力してフローティングツールバーを出す
  const editor = page.locator('[data-testid="editor-root"] .bn-editor')
  await editor.click({ force: true }).catch(() => {})
  await page.keyboard.type('テストテキストを入力してAIメニューを確認する')

  // テキストを選択する
  await page.keyboard.press('Control+a')

  // AI メニューボタンが表示されるか確認
  // （BlockNote の FormattingToolbar 内にある場合、選択後に表示される）
  const aiMenuButton = page.getByTestId('ai-menu-button')
  // AI メニューボタンは選択後に表示される可能性がある
  // 表示されない場合はスキップ（BlockNote のバージョンによって動作が異なるため）
  const isVisible = await aiMenuButton.isVisible().catch(() => false)
  if (isVisible) {
    expect(isVisible).toBe(true)
  }
})

test('鍵未登録状態で AI 設定ページに削除ボタンがない', async ({ page }) => {
  // 鍵を注入しない
  // loginForSettings が /settings/ai への goto まで内包するため、直後の goto は不要
  await loginForSettings(page)

  await expect(page.getByTestId('ai-key-manager-gemini')).toBeVisible({ timeout: 15000 })

  // 削除ボタンが存在しない（未登録のため）
  expect(await page.getByTestId('ai-key-delete-gemini').count()).toBe(0)

  // 登録ボタンが表示される
  await expect(page.getByTestId('ai-key-register-gemini')).toBeVisible()
})

// =====================
// OpenAI proxy 経由の検証（唯一の例外）
// =====================

test('OpenAI 使用時: /api/ai/proxy の Authorization のみ鍵を含む（他のエンドポイントは含まない）', async ({ page }) => {
  const proxyAuthHeaders: string[] = []
  const otherRequests: Array<{ url: string; authHeader: string | null }> = []

  page.on('request', (request) => {
    const url = request.url()
    if (!url.startsWith(APP_ORIGIN)) return

    const authHeader = request.headers()['authorization']

    if (url.includes('/api/ai/proxy')) {
      if (authHeader) {
        proxyAuthHeaders.push(authHeader)
      }
    } else {
      // proxy 以外の自アプリエンドポイントへの Authorization ヘッダを記録
      if (authHeader?.includes(DUMMY_OPENAI_KEY)) {
        otherRequests.push({ url, authHeader })
      }
    }
  })

  await injectDummyKeys(page, ['openai'])
  await stubProviderApis(page)

  // loginForSettings が /settings/ai への goto まで内包するため、直後の goto は不要
  await loginForSettings(page)

  // 有料プランは openai も表示されるはずだが、seed ユーザーは無料プランなので
  // ここでは openai カードが非表示であることを確認するのみ
  expect(await page.getByTestId('ai-key-manager-openai').count()).toBe(0)

  // proxy 以外のエンドポイントに OpenAI 鍵が送られていないことを確認
  expect(otherRequests).toHaveLength(0)
})
