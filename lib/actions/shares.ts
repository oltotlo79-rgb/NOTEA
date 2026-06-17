/**
 * @module lib/actions/shares
 * ページ共有リンクの発行・失効・一覧（所有者専用 Server Actions）。
 *
 * トークンの生成と保存はここに集約する。所有者の認証 + ページ所有確認を必ず通し、
 * RLS owner ポリシーと合わせて多層防御する。トークン解決（匿名/非所有者の閲覧・編集）は
 * lib/actions/shared-pages.ts の SECURITY DEFINER 関数経由で行い、このモジュールには含めない。
 */
'use server'

import { randomBytes } from 'node:crypto'
import {
  ERR_PAGE_NOT_FOUND,
  ERR_INVALID_INPUT,
  ERR_SHARE_CREATE_FAILED,
  ERR_SHARE_REVOKE_FAILED,
  ERR_DB,
} from '@/lib/constants/errors'
import { SHARE_TOKEN_BYTES, type SharePermission } from '@/lib/constants/limits'
import { createClient } from '@/lib/supabase/server'
import { actionError, actionSuccess, type ActionResult } from '@/types/action-result'
import { createShareSchema, listSharesSchema, revokeShareSchema } from '@/lib/validations/share'
import { requireUser } from './utils'

export type ShareInfo = {
  permission: SharePermission
  token: string
}

async function assertPageOwned(pageId: string, userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pages')
    .select('id')
    .eq('id', pageId)
    .eq('user_id', userId)
    .eq('is_trashed', false)
    .maybeSingle()
  return data !== null
}

export async function createShare(input: {
  pageId: string
  permission: SharePermission
}): Promise<ActionResult<ShareInfo>> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = createShareSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const { pageId, permission } = parsed.data

  // 3. 所有確認（RLS に加えた多層防御。他人のページは共有できない）
  if (!(await assertPageOwned(pageId, userId))) return actionError(ERR_PAGE_NOT_FOUND)

  const supabase = await createClient()

  // 既存リンクがあればそれを返す（再発行で URL を無効化しない＝冪等な「発行」）
  const { data: existing } = await supabase
    .from('page_shares')
    .select('token, permission')
    .eq('page_id', pageId)
    .eq('permission', permission)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return actionSuccess({ permission, token: existing.token })

  const token = randomBytes(SHARE_TOKEN_BYTES).toString('base64url')

  const { error } = await supabase
    .from('page_shares')
    .insert({ page_id: pageId, user_id: userId, token, permission })

  if (error) return actionError(ERR_SHARE_CREATE_FAILED)

  return actionSuccess({ permission, token })
}

export async function revokeShare(input: {
  pageId: string
  permission: SharePermission
}): Promise<ActionResult> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = revokeShareSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const { pageId, permission } = parsed.data

  const supabase = await createClient()

  // user_id 一致で削除（RLS owner_delete に加えた多層防御）
  const { error } = await supabase
    .from('page_shares')
    .delete()
    .eq('page_id', pageId)
    .eq('permission', permission)
    .eq('user_id', userId)

  if (error) return actionError(ERR_SHARE_REVOKE_FAILED)

  return actionSuccess()
}

/**
 * 指定ページの共有リンク一覧を返す。
 *
 * Returns custom shape instead of ActionResult because:
 * - 呼び出し側（ShareDialog）は view/edit の有無を配列で受け取る方が簡潔
 * - 取得失敗時も UI は空配列を fallback として自然に扱える
 */
export async function listShares(input: {
  pageId: string
}): Promise<{ data: ShareInfo[]; error?: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { data: [], error: auth.error }
  const { userId } = auth

  const parsed = listSharesSchema.safeParse(input)
  if (!parsed.success) return { data: [], error: ERR_INVALID_INPUT }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('page_shares')
    .select('token, permission')
    .eq('page_id', parsed.data.pageId)
    .eq('user_id', userId)

  if (error) return { data: [], error: ERR_DB }

  const shares: ShareInfo[] = (data ?? []).map((row) => ({
    permission: row.permission === 'edit' ? 'edit' : 'view',
    token: row.token,
  }))

  return { data: shares }
}
