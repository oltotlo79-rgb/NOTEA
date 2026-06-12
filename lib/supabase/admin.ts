import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/utils/env'
import type { Database } from '@/types/database'

// RLS をバイパスする。webhook / cron / アカウント削除などユーザーセッションが無い処理専用
export function createAdminClient() {
  return createSupabaseClient<Database>(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
