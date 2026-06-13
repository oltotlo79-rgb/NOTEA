import { createClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'
import path from 'path'

// Playwright ワーカープロセスは .env.local を自動ロードしないため明示的に読む
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// E2E seed ユーザーの固定 UUID（supabase/seed.sql と一致）
export const SEED_USER_ID = '11111111-1111-1111-1111-111111111111'

/**
 * service_role クライアント（RLS をバイパス）でシードユーザーのページを全削除する。
 *
 * テスト間のデータ分離のために各 spec の beforeEach から呼ぶ。
 * global-setup の db reset はラン全体の1回だけ実行されるが、
 * シリアル実行でも前のテストが作ったページが残るため per-test クリアが必要。
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

  const { error } = await admin
    .from('pages')
    .delete()
    .eq('user_id', SEED_USER_ID)

  if (error) {
    throw new Error(`cleanupSeedUserPages failed: ${error.message}`)
  }
}
