/**
 * @module lib/actions/images
 * 画像の署名付きアップロードURL発行・削除の Server Actions。
 * ユーザーの AI キーは一切扱わない。パスはサーバーで構築し、クライアント指定を信用しない。
 */
'use server'

import { z } from 'zod'
import {
  ERR_DB,
  ERR_IMAGE_PATH_FORBIDDEN,
  ERR_IMAGE_TOO_LARGE,
  ERR_INVALID_IMAGE_TYPE,
  ERR_INVALID_INPUT,
  ERR_PAGE_NOT_FOUND,
  ERR_STORAGE_LIMIT_REACHED,
} from '@/lib/constants/errors'
import { FREE_MAX_STORAGE_MB, MAX_IMAGE_STORED_SIZE_MB, PAID_MAX_STORAGE_GB } from '@/lib/constants/limits'
import { getStorageUsage } from '@/lib/services/usage'
import { createClient } from '@/lib/supabase/server'
import { actionError, actionSuccess, type ActionResult } from '@/types/action-result'
import { requireUser } from './utils'

const MAX_IMAGE_STORED_BYTES = MAX_IMAGE_STORED_SIZE_MB * 1024 * 1024

const createUploadUrlSchema = z.object({
  pageId: z.string().uuid(),
  contentType: z.literal('image/webp'),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_STORED_BYTES),
})

const deleteImageSchema = z.object({
  path: z.string().min(1),
})

export type CreateUploadUrlInput = z.infer<typeof createUploadUrlSchema>
export type DeleteImageInput = z.infer<typeof deleteImageSchema>

export type UploadUrlResult = {
  path: string
  token: string
  signedUrl: string
}

/**
 * 署名付きアップロードURLを発行する。
 * パスはサーバーで `{userId}/{pageId}/{uuid}.webp` と構築する。
 * クライアントはこの URL に PUT してファイルをアップロードする。
 */
export async function createUploadUrl(
  input: CreateUploadUrlInput
): Promise<ActionResult<UploadUrlResult>> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = createUploadUrlSchema.safeParse(input)
  if (!parsed.success) {
    if (input.contentType !== 'image/webp') return actionError(ERR_INVALID_IMAGE_TYPE)
    if (input.sizeBytes > MAX_IMAGE_STORED_BYTES)
      return actionError(ERR_IMAGE_TOO_LARGE(MAX_IMAGE_STORED_SIZE_MB))
    return actionError(ERR_INVALID_INPUT)
  }
  const { pageId, sizeBytes } = parsed.data

  // 3. 容量チェック（Zod 通過後）
  const { usedBytes, limitBytes } = await getStorageUsage(userId)
  if (usedBytes + sizeBytes > limitBytes) {
    const limitLabel =
      limitBytes >= 1024 * 1024 * 1024
        ? `${PAID_MAX_STORAGE_GB}GB`
        : `${FREE_MAX_STORAGE_MB}MB`
    return actionError(ERR_STORAGE_LIMIT_REACHED(limitLabel))
  }

  // 4. ページ所有確認
  const supabase = await createClient()
  const { data: page } = await supabase
    .from('pages')
    .select('id')
    .eq('id', pageId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!page) return actionError(ERR_PAGE_NOT_FOUND)

  // 5. パスをサーバーで構築して署名付きURLを発行
  const path = `${userId}/${pageId}/${crypto.randomUUID()}.webp`
  const { data, error } = await supabase.storage
    .from('page-images')
    .createSignedUploadUrl(path)

  if (error || !data) return actionError(ERR_DB)

  return actionSuccess({ path, token: data.token, signedUrl: data.signedUrl })
}

/**
 * 画像を削除する。
 * path の先頭セグメント（userId）がセッションユーザーと一致することをサーバーで検証し、
 * 他ユーザーの画像を削除できないようにする。
 */
export async function deleteImage(input: DeleteImageInput): Promise<ActionResult> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = deleteImageSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const { path } = parsed.data

  // 3. パスの所有者検証（先頭セグメントが userId と一致しなければ拒否）
  const pathOwnerId = path.split('/')[0]
  if (pathOwnerId !== userId) return actionError(ERR_IMAGE_PATH_FORBIDDEN)

  // 4. 削除
  const supabase = await createClient()
  const { error } = await supabase.storage.from('page-images').remove([path])
  if (error) return actionError(ERR_DB)

  return actionSuccess()
}
