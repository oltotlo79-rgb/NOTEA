/**
 * @module lib/actions/profile
 * プロフィール取得・更新・アカウント削除の Server Actions。
 * アカウント削除は auth.users を admin クライアントで削除し、
 * cascade で profiles / pages / ai_usage を連鎖削除する。
 * Storage の {userId}/ 配下画像は別途削除する。
 */
'use server'

import { z } from 'zod'
import {
  actionError,
  actionSuccess,
  type ActionResult,
} from '@/types/action-result'
import { requireUser } from '@/lib/actions/utils'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ERR_ACCOUNT_DELETE_CONFIRMATION,
  ERR_ACCOUNT_DELETE_FAILED,
  ERR_DB,
  ERR_INVALID_INPUT,
  ERR_PROFILE_NOT_FOUND,
  ERR_PROFILE_UPDATE_FAILED,
} from '@/lib/constants/errors'
import {
  ACCOUNT_DELETE_CONFIRMATION,
  MAX_DISPLAY_NAME_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
} from '@/lib/constants/limits'
import { revalidatePath } from 'next/cache'

export type ProfileData = {
  displayName: string
  plan: 'free' | 'paid'
}

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(MIN_DISPLAY_NAME_LENGTH)
    .max(MAX_DISPLAY_NAME_LENGTH),
})

const deleteAccountSchema = z.object({
  confirmation: z.string(),
})

/** 認証済みユーザーのプロフィール（表示名・プラン）を取得する */
export async function getProfile(): Promise<ActionResult<ProfileData>> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)

  // 2. プロフィール取得
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, plan')
    .eq('id', auth.userId)
    .maybeSingle()

  if (error) return actionError(ERR_DB)
  if (!data) return actionError(ERR_PROFILE_NOT_FOUND)

  return actionSuccess({
    displayName: data.display_name,
    plan: data.plan === 'paid' ? 'paid' : 'free',
  })
}

/** 表示名を更新する */
export async function updateProfile(input: {
  displayName: string
}): Promise<ActionResult<void>> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)

  // 2. Zod バリデーション
  const parsed = updateProfileSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // 3. ビジネスロジック
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.displayName })
    .eq('id', auth.userId)

  if (error) return actionError(ERR_PROFILE_UPDATE_FAILED)

  // 4. キャッシュ無効化
  revalidatePath('/settings/profile')

  return actionSuccess()
}

/**
 * アカウントを削除する。
 *
 * confirmation が ACCOUNT_DELETE_CONFIRMATION と一致しなければ即座に拒否する。
 * auth.users を admin クライアントで削除することで、cascade により
 * profiles / pages / ai_usage が連鎖削除される。
 * Storage の {userId}/ 配下画像は DB 削除前に明示的に削除する
 * （Storage は cascade 対象外のため）。
 */
export async function deleteAccount(input: {
  confirmation: string
}): Promise<ActionResult<void>> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)

  // 2. Zod バリデーション
  const parsed = deleteAccountSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // 3. confirmation 一致チェック（Zod 通過後）
  if (parsed.data.confirmation !== ACCOUNT_DELETE_CONFIRMATION) {
    return actionError(ERR_ACCOUNT_DELETE_CONFIRMATION)
  }

  const { userId } = auth
  const admin = createAdminClient()

  // 4. Storage の {userId}/ 配下を削除する（page_id フォルダ → ファイル の二段階）
  const { data: folders } = await admin.storage.from('page-images').list(userId)
  if (folders && folders.length > 0) {
    for (const folder of folders) {
      const prefix = `${userId}/${folder.name}`
      const { data: files } = await admin.storage.from('page-images').list(prefix)
      if (files && files.length > 0) {
        const paths = files.map((f) => `${prefix}/${f.name}`)
        await admin.storage.from('page-images').remove(paths)
      }
    }
    // フォルダエントリ自体は Storage では自動消滅するが、念のためフォルダプレフィックスも削除
    const folderPaths = folders.map((f) => `${userId}/${f.name}`)
    await admin.storage.from('page-images').remove(folderPaths)
  }

  // 5. auth.users を削除（cascade で profiles / pages / ai_usage が連鎖削除される）
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return actionError(ERR_ACCOUNT_DELETE_FAILED)

  return actionSuccess()
}
