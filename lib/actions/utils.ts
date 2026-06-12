import { ERR_AUTH_REQUIRED, ERR_DB, ERR_PAGE_LIMIT_REACHED, ERR_PAID_REQUIRED } from '@/lib/constants/errors'
import { FREE_MAX_PAGES } from '@/lib/constants/limits'
import { createClient } from '@/lib/supabase/server'

export type AuthResult = { userId: string } | { error: string }
export type LimitAction = 'create_page'

export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: ERR_AUTH_REQUIRED }
  return { userId: user.id }
}

async function getUserPlan(userId: string): Promise<'free' | 'paid'> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('plan').eq('id', userId).maybeSingle()
  return data?.plan === 'paid' ? 'paid' : 'free'
}

export async function requirePaidUser(): Promise<AuthResult> {
  const auth = await requireUser()
  if ('error' in auth) return auth
  const plan = await getUserPlan(auth.userId)
  if (plan !== 'paid') return { error: ERR_PAID_REQUIRED }
  return auth
}

export async function enforcePlanLimit(
  userId: string,
  action: LimitAction
): Promise<{ error: string } | null> {
  if (action !== 'create_page') return null
  const plan = await getUserPlan(userId)
  if (plan === 'paid') return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('count_user_pages')
  if (error || data === null) return { error: ERR_DB }
  if (data >= FREE_MAX_PAGES) return { error: ERR_PAGE_LIMIT_REACHED(FREE_MAX_PAGES) }
  return null
}
