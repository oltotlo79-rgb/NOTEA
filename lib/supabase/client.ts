import { createBrowserClient } from '@supabase/ssr'
import { requireEnv } from '@/lib/utils/env'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
}
