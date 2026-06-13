/**
 * @module lib/actions/pages
 * ページ管理の Server Actions。
 *
 * getPageTree / listTrashedPages は ActionResult<T> ではなく custom shape
 * { data; error? } / { data; nextCursor?; error? } を返す。
 * これはクライアントの React Query が fallback として空配列を自然に使え、
 * カーソルページネーションでは nextCursor を別フィールドで返した方が
 * 呼び出し側（useInfiniteQuery）を簡潔にできるためである。
 */
'use server'

import { revalidatePath } from 'next/cache'
import {
  ERR_DB,
  ERR_INVALID_INPUT,
  ERR_PAGE_CIRCULAR,
  ERR_PAGE_CONTENT_TOO_LARGE,
  ERR_PAGE_DEPTH_LIMIT,
  ERR_PAGE_LIMIT_REACHED,
  ERR_PAGE_NOT_FOUND,
} from '@/lib/constants/errors'
import { FREE_MAX_PAGES, MAX_PAGE_CONTENT_BYTES, MAX_PAGE_DEPTH, TRASH_PAGE_SIZE } from '@/lib/constants/limits'
import { getDepth, getSubtreeIds, type PageListItem } from '@/lib/services/page-tree'
import { PAGE_LIST_SELECT } from '@/lib/supabase/shared-selects'
import { createClient } from '@/lib/supabase/server'
import {
  createPageSchema,
  listCursorSchema,
  movePageSchema,
  pageIdSchema,
  reorderPageSchema,
  updateContentSchema,
  updateMetaSchema,
} from '@/lib/validations/pages'
import { actionError, actionSuccess, type ActionResult } from '@/types/action-result'
import type { Json } from '@/types/database'
import { enforcePlanLimit, requireUser } from './utils'

// ごみ箱一覧の行型（listTrashedPages の data 要素）
type TrashedPageItem = {
  id: string
  title: string
  icon: string | null
  trashed_at: string
}

// ページツリー取得用の最小カラム型
type PageNodeRef = {
  id: string
  parent_id: string | null
}

// ストレージから各ページの画像フォルダを削除するプライベートヘルパー
async function deletePageImages(userId: string, pageIds: string[]): Promise<void> {
  const supabase = await createClient()
  for (const pageId of pageIds) {
    const prefix = `${userId}/${pageId}`
    const { data: files } = await supabase.storage.from('page-images').list(prefix)
    if (files && files.length > 0) {
      const paths = files.map((f) => `${prefix}/${f.name}`)
      await supabase.storage.from('page-images').remove(paths)
    }
  }
}

export async function createPage(input: {
  parentId?: string | null
  title?: string
}): Promise<ActionResult<{ id: string }>> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = createPageSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // 3. 制限チェック
  const limit = await enforcePlanLimit(userId, 'create_page')
  if (limit) return actionError(limit.error)

  const supabase = await createClient()
  const { parentId, title } = parsed.data

  // 4. ビジネスロジック
  let sortOrder = 0

  if (parentId) {
    // 親の存在確認と深さチェックのために全ページ（id, parent_id）を取得
    const { data: allPages, error: pagesError } = await supabase
      .from('pages')
      .select('id, parent_id')
      .eq('user_id', userId)
      .eq('is_trashed', false)

    if (pagesError || !allPages) return actionError(ERR_DB)

    const parentExists = allPages.some((p) => p.id === parentId)
    if (!parentExists) return actionError(ERR_PAGE_NOT_FOUND)

    const depth = getDepth(allPages, parentId)
    if (depth >= MAX_PAGE_DEPTH) return actionError(ERR_PAGE_DEPTH_LIMIT)

    // 同一親の末尾に配置するため max(sort_order) + 1 を計算
    const { data: siblings } = await supabase
      .from('pages')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('parent_id', parentId)
      .eq('is_trashed', false)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    sortOrder = (siblings?.sort_order ?? -1) + 1
  } else {
    // ルートレベルの末尾に配置
    const { data: rootSibling } = await supabase
      .from('pages')
      .select('sort_order')
      .eq('user_id', userId)
      .is('parent_id', null)
      .eq('is_trashed', false)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    sortOrder = (rootSibling?.sort_order ?? -1) + 1
  }

  const { data: newPage, error: insertError } = await supabase
    .from('pages')
    .insert({
      user_id: userId,
      parent_id: parentId ?? null,
      title: title ?? '',
      sort_order: sortOrder,
    })
    .select('id')
    .single()

  if (insertError || !newPage) return actionError(ERR_DB)

  // 5. キャッシュ無効化
  revalidatePath('/pages', 'layout')

  // 6. 成功
  return actionSuccess({ id: newPage.id })
}

export async function updatePageContent(input: {
  id: string
  content: unknown[]
  contentText: string
}): Promise<ActionResult> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = updateContentSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // 3. バイトサイズチェック（制限チェックはプラン制限ではなくコンテンツサイズ制限）
  const byteLength = new TextEncoder().encode(JSON.stringify(parsed.data.content)).length
  if (byteLength > MAX_PAGE_CONTENT_BYTES) return actionError(ERR_PAGE_CONTENT_TOO_LARGE)

  const supabase = await createClient()

  // 4. ビジネスロジック
  // content の unknown[] を DB の Json 型に合わせる。JSON.parse の戻り値 any を
  // Json 型注釈で受けることでシリアライズ可能な値に絞り込む（as キャストを使わない）
  const contentAsJson: Json = JSON.parse(JSON.stringify(parsed.data.content))

  const { error } = await supabase
    .from('pages')
    .update({
      content: contentAsJson,
      content_text: parsed.data.contentText,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('user_id', userId)
    .eq('is_trashed', false)

  if (error) return actionError(ERR_DB)

  // 5. キャッシュ無効化
  revalidatePath(`/pages/${parsed.data.id}`)

  return actionSuccess()
}

export async function updatePageMeta(input: {
  id: string
  title?: string
  icon?: string | null
}): Promise<ActionResult> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション（title と icon の両方 undefined は refine で拒否）
  const parsed = updateMetaSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const supabase = await createClient()

  // 渡された項目のみ update オブジェクトに含める
  const updateFields: { title?: string; icon?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.title !== undefined) updateFields.title = parsed.data.title
  if (parsed.data.icon !== undefined) updateFields.icon = parsed.data.icon

  // 4. ビジネスロジック
  const { error } = await supabase
    .from('pages')
    .update(updateFields)
    .eq('id', parsed.data.id)
    .eq('user_id', userId)

  if (error) return actionError(ERR_DB)

  // 5. キャッシュ無効化
  revalidatePath('/pages', 'layout')
  revalidatePath(`/pages/${parsed.data.id}`)

  return actionSuccess()
}

export async function movePage(input: {
  id: string
  newParentId: string | null
}): Promise<ActionResult> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = movePageSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const supabase = await createClient()

  // 4. ビジネスロジック
  if (parsed.data.newParentId === null) {
    // ルートへの移動は循環/深さチェック不要。生成型の non-null 制約も回避するため直接 update
    const { error } = await supabase
      .from('pages')
      .update({ parent_id: null })
      .eq('id', parsed.data.id)
      .eq('user_id', userId)

    if (error) return actionError(ERR_DB)
  } else {
    // 非 null の移動は DB 側の move_page 関数で循環・深さをチェック
    const { error } = await supabase.rpc('move_page', {
      p_page_id: parsed.data.id,
      p_new_parent_id: parsed.data.newParentId,
    })

    if (error) {
      if (error.message.includes('CIRCULAR_REFERENCE')) return actionError(ERR_PAGE_CIRCULAR)
      if (error.message.includes('DEPTH_LIMIT_EXCEEDED')) return actionError(ERR_PAGE_DEPTH_LIMIT)
      return actionError(ERR_DB)
    }
  }

  // 5. キャッシュ無効化
  revalidatePath('/pages', 'layout')

  return actionSuccess()
}

export async function reorderPage(input: {
  id: string
  sortOrder: number
}): Promise<ActionResult> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = reorderPageSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const supabase = await createClient()

  // 4. ビジネスロジック
  const { error } = await supabase
    .from('pages')
    .update({ sort_order: parsed.data.sortOrder })
    .eq('id', parsed.data.id)
    .eq('user_id', userId)

  if (error) return actionError(ERR_DB)

  // 5. キャッシュ無効化
  revalidatePath('/pages', 'layout')

  return actionSuccess()
}

export async function trashPage(id: string): Promise<ActionResult> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = pageIdSchema.safeParse({ id })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const supabase = await createClient()

  // 4. ビジネスロジック: 非ごみ箱ページの取得とサブツリー計算
  const { data: allPages, error: fetchError } = await supabase
    .from('pages')
    .select('id, parent_id')
    .eq('user_id', userId)
    .eq('is_trashed', false)

  if (fetchError || !allPages) return actionError(ERR_DB)

  const targetExists = allPages.some((p: PageNodeRef) => p.id === parsed.data.id)
  if (!targetExists) return actionError(ERR_PAGE_NOT_FOUND)

  const subtreeIds = getSubtreeIds(allPages, parsed.data.id)
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('pages')
    .update({ is_trashed: true, trashed_at: now })
    .in('id', subtreeIds)
    .eq('user_id', userId)

  if (updateError) return actionError(ERR_DB)

  // 5. キャッシュ無効化
  revalidatePath('/pages', 'layout')
  revalidatePath('/trash')

  return actionSuccess()
}

export async function restorePage(id: string): Promise<ActionResult> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = pageIdSchema.safeParse({ id })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const supabase = await createClient()

  // 4. ビジネスロジック: ごみ箱内ページのサブツリー取得
  const { data: trashedPages, error: fetchError } = await supabase
    .from('pages')
    .select('id, parent_id')
    .eq('user_id', userId)
    .eq('is_trashed', true)

  if (fetchError || !trashedPages) return actionError(ERR_DB)

  const root = trashedPages.find((p: PageNodeRef) => p.id === parsed.data.id)
  if (!root) return actionError(ERR_PAGE_NOT_FOUND)

  const subtreeIds = getSubtreeIds(trashedPages, parsed.data.id)

  // 無料プランは復元後のページ数が上限を超えないか確認
  const { data: planData } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()

  if (planData?.plan !== 'paid') {
    const { data: currentCount, error: countError } = await supabase.rpc('count_user_pages')
    if (countError || currentCount === null) return actionError(ERR_DB)
    if (currentCount + subtreeIds.length > FREE_MAX_PAGES) {
      return actionError(ERR_PAGE_LIMIT_REACHED(FREE_MAX_PAGES))
    }
  }

  // 元の親が存在するか確認。存在しない or ごみ箱中ならルートに昇格させる
  let newParentId: string | null = root.parent_id
  if (newParentId !== null) {
    const { data: parentPage } = await supabase
      .from('pages')
      .select('id, is_trashed')
      .eq('id', newParentId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!parentPage || parentPage.is_trashed) {
      newParentId = null
    }
  }

  // サブツリー全体を復元
  const { error: restoreError } = await supabase
    .from('pages')
    .update({ is_trashed: false, trashed_at: null })
    .in('id', subtreeIds)
    .eq('user_id', userId)

  if (restoreError) return actionError(ERR_DB)

  // ルートの parent_id が変わる場合のみ別 update
  if (newParentId !== root.parent_id) {
    const { error: parentUpdateError } = await supabase
      .from('pages')
      .update({ parent_id: newParentId })
      .eq('id', parsed.data.id)
      .eq('user_id', userId)

    if (parentUpdateError) return actionError(ERR_DB)
  }

  // 5. キャッシュ無効化
  revalidatePath('/pages', 'layout')
  revalidatePath('/trash')

  return actionSuccess()
}

export async function deletePagePermanently(id: string): Promise<ActionResult> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)
  const { userId } = auth

  // 2. Zod バリデーション
  const parsed = pageIdSchema.safeParse({ id })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const supabase = await createClient()

  // 4. ビジネスロジック: ごみ箱内ページのサブツリー取得
  const { data: trashedPages, error: fetchError } = await supabase
    .from('pages')
    .select('id, parent_id')
    .eq('user_id', userId)
    .eq('is_trashed', true)

  if (fetchError || !trashedPages) return actionError(ERR_DB)

  const targetExists = trashedPages.some((p: PageNodeRef) => p.id === parsed.data.id)
  if (!targetExists) return actionError(ERR_PAGE_NOT_FOUND)

  const subtreeIds = getSubtreeIds(trashedPages, parsed.data.id)

  // 各ページの Storage 画像を削除（M2 では画像なし = no-op）
  await deletePageImages(userId, subtreeIds)

  // DB は cascade delete で子孫も削除される（pages_parent_id_fkey on delete cascade）
  const { error: deleteError } = await supabase
    .from('pages')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', userId)

  if (deleteError) return actionError(ERR_DB)

  // 5. キャッシュ無効化
  revalidatePath('/trash')

  return actionSuccess()
}

export async function getPageTree(): Promise<{ data: PageListItem[]; error?: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { data: [], error: auth.error }
  const { userId } = auth

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pages')
    .select(PAGE_LIST_SELECT)
    .eq('user_id', userId)
    .eq('is_trashed', false)
    .order('sort_order', { ascending: true })

  if (error) return { data: [], error: ERR_DB }

  // PAGE_LIST_SELECT の shape は PageListItem と一致する
  const items: PageListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    parent_id: row.parent_id,
    title: row.title,
    icon: row.icon,
    sort_order: row.sort_order,
  }))

  return { data: items }
}

export async function listTrashedPages(cursor?: string): Promise<{
  data: TrashedPageItem[]
  nextCursor?: string
  error?: string
}> {
  const auth = await requireUser()
  if ('error' in auth) return { data: [], error: auth.error }
  const { userId } = auth

  // Zod でカーソル文字列を検証
  const parsed = listCursorSchema.safeParse({ cursor })
  if (!parsed.success) return { data: [], error: ERR_INVALID_INPUT }

  const supabase = await createClient()

  let query = supabase
    .from('pages')
    .select('id, title, icon, trashed_at')
    .eq('user_id', userId)
    .eq('is_trashed', true)
    .order('trashed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(TRASH_PAGE_SIZE)

  if (parsed.data.cursor) {
    query = query.lt('trashed_at', parsed.data.cursor)
  }

  const { data, error } = await query

  if (error) return { data: [], error: ERR_DB }

  const rows = data ?? []

  // trashed_at が null のレコードは型上 string | null なので安全にフィルタ
  const items: TrashedPageItem[] = rows.flatMap((row) => {
    if (row.trashed_at === null) return []
    return [{ id: row.id, title: row.title, icon: row.icon, trashed_at: row.trashed_at }]
  })

  // 満杯時のみ nextCursor を返す（最後の要素の trashed_at）
  const nextCursor =
    rows.length === TRASH_PAGE_SIZE ? (rows[rows.length - 1]?.trashed_at ?? undefined) : undefined

  return { data: items, nextCursor }
}
