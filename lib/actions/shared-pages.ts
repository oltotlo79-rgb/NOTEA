/**
 * @module lib/actions/shared-pages
 * 共有トークン経由のページアクセス（匿名閲覧・ログイン編集・共有画像の署名URL）。
 *
 * 匿名/非所有者は pages の owner RLS を通れないため、トークン解決は SECURITY DEFINER 関数
 * （get_shared_page / update_shared_page）に集約する。トークン検証は関数内で行い、
 * RLS には載せない（RLS は token を認可コンテキストに持てないため）。
 *
 * getSharedPage / getSharedImageUrl は ActionResult ではなく custom shape を返す:
 * - 呼び出し側（公開ビュー）は「無ければ 404」を null で扱う方が簡潔
 * - 画像は失敗時に壊れた img を出さず空 url を fallback できる
 */
'use server'

import { revalidatePath } from 'next/cache'
import {
  ERR_DB,
  ERR_INVALID_INPUT,
  ERR_PAGE_CONTENT_TOO_LARGE,
  ERR_SHARE_NOT_FOUND,
} from '@/lib/constants/errors'
import { MAX_PAGE_CONTENT_BYTES, SIGNED_URL_EXPIRES_IN } from '@/lib/constants/limits'
import { ROUTES } from '@/lib/constants/routes'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { actionError, actionSuccess, type ActionResult } from '@/types/action-result'
import {
  sharedImageSchema,
  sharedPageTokenSchema,
  updateSharedContentSchema,
} from '@/lib/validations/share'
import type { Json } from '@/types/database'
import { requireUser } from './utils'

export type SharedPage = {
  id: string
  title: string
  icon: string | null
  content: Json
  contentText: string
  updatedAt: string
  permission: 'view' | 'edit'
}

export async function getSharedPage(
  token: string
): Promise<{ data: SharedPage | null; error?: string }> {
  const parsed = sharedPageTokenSchema.safeParse({ token })
  if (!parsed.success) return { data: null }

  const supabase = await createClient()
  // SECURITY DEFINER 関数。匿名（anon）でも execute 可。
  const { data, error } = await supabase.rpc('get_shared_page', { p_token: parsed.data.token })
  if (error) return { data: null, error: ERR_DB }

  const row = data?.[0]
  if (!row) return { data: null }

  return {
    data: {
      id: row.id,
      title: row.title,
      icon: row.icon,
      content: row.content,
      contentText: row.content_text,
      updatedAt: row.updated_at,
      permission: row.permission === 'edit' ? 'edit' : 'view',
    },
  }
}

export async function updateSharedPageContent(input: {
  token: string
  content: unknown[]
  contentText: string
}): Promise<ActionResult> {
  // 1. 認証（編集はログイン必須）
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)

  // 2. Zod バリデーション
  const parsed = updateSharedContentSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // 3. コンテンツサイズチェック
  const byteLength = new TextEncoder().encode(JSON.stringify(parsed.data.content)).length
  if (byteLength > MAX_PAGE_CONTENT_BYTES) return actionError(ERR_PAGE_CONTENT_TOO_LARGE)

  const supabase = await createClient()

  const contentAsJson: Json = JSON.parse(JSON.stringify(parsed.data.content))

  // SECURITY DEFINER 関数。edit トークン + 認証済み呼び出しのみ更新する（関数内で検証）。
  const { error } = await supabase.rpc('update_shared_page', {
    p_token: parsed.data.token,
    p_content: contentAsJson,
    p_content_text: parsed.data.contentText,
  })

  if (error) return actionError(ERR_SHARE_NOT_FOUND)

  revalidatePath(`${ROUTES.SHARE}/${parsed.data.token}`)

  return actionSuccess()
}

/**
 * 共有ページの画像（Storage path）に対する署名付き閲覧 URL を返す。
 *
 * Storage は所有者プレフィックス（{user_id}/...）の RLS のため、匿名/非所有者は
 * 署名 URL を作れない。トークンを検証したうえで admin（service_role）で署名する。
 * path が共有ページ所有者のプレフィックス配下であることを必ず確認し、他人の画像を
 * 引けないようにする（admin は RLS をバイパスするため、ここでの検証が認可の要）。
 */
export async function getSharedImageUrl(input: {
  token: string
  path: string
}): Promise<{ url: string | null; error?: string }> {
  const parsed = sharedImageSchema.safeParse(input)
  if (!parsed.success) return { url: null, error: ERR_INVALID_INPUT }

  const admin = createAdminClient()

  const { data: share } = await admin
    .from('page_shares')
    .select('user_id')
    .eq('token', parsed.data.token)
    .maybeSingle()

  if (!share) return { url: null, error: ERR_SHARE_NOT_FOUND }

  // path の先頭フォルダ（所有者 user_id）が共有所有者と一致することを検証
  const ownerPrefix = `${share.user_id}/`
  if (!parsed.data.path.startsWith(ownerPrefix)) return { url: null, error: ERR_SHARE_NOT_FOUND }

  const { data, error } = await admin.storage
    .from('page-images')
    .createSignedUrl(parsed.data.path, SIGNED_URL_EXPIRES_IN)

  if (error || !data) return { url: null, error: ERR_DB }

  return { url: data.signedUrl }
}
