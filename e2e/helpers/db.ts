import { createClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'
import path from 'path'

// Playwright ワーカープロセスは .env.local を自動ロードしないため明示的に読む
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// E2E seed ユーザーの固定 UUID（supabase/seed.sql と一致）
export const SEED_USER_ID = '11111111-1111-1111-1111-111111111111'

// PostgREST 起動直後に断続的に発生する "schema cache" エラーのパターン
const SCHEMA_CACHE_ERROR_PATTERN = /schema cache/i

// リトライ間の待機時間（ms）。PostgREST が自己回復するのに十分な時間を確保する。
const RETRY_DELAY_MS = 2000

/**
 * service_role クライアント（RLS をバイパス）でシードユーザーのページを全削除する。
 *
 * テスト間のデータ分離のために各 spec の beforeEach から呼ぶ。
 * global-setup の db reset はラン全体の1回だけ実行されるが、
 * シリアル実行でも前のテストが作ったページが残るため per-test クリアが必要。
 *
 * "public.pages not in schema cache" のような断続的な PostgREST 起動直後のエラーに対し、
 * 待機 + リトライで吸収する（環境起因のため E2E 側で対処する）。
 * PostgREST は数秒でスキーマを自己回復するため、リトライで解消する。
 */
export async function cleanupSeedUserPages(): Promise<void> {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local を確認してください。'
    )
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const MAX_RETRIES = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { error } = await admin
      .from('pages')
      .delete()
      .eq('user_id', SEED_USER_ID)

    if (!error) return

    lastError = new Error(`cleanupSeedUserPages failed: ${error.message}`)

    if (SCHEMA_CACHE_ERROR_PATTERN.test(error.message)) {
      // PostgREST のスキーマキャッシュ未準備 — しばらく待って再試行する
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      continue
    }

    // スキーマキャッシュ以外のエラーはリトライ不要
    throw lastError
  }

  throw lastError ?? new Error('cleanupSeedUserPages: unexpected state')
}
