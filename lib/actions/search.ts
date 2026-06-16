/**
 * @module lib/actions/search
 * ページ全文検索 Server Action。
 *
 * Returns custom shape instead of ActionResult because:
 * - 呼び出し側（useInfiniteQuery）がカーソルを別フィールドで受け取る方が簡潔になる
 * - 検索エラー時も UI は空配列を fallback として自然に扱える
 */
'use server'

import { ERR_DB } from '@/lib/constants/errors'
import { SEARCH_PAGE_SIZE } from '@/lib/constants/limits'
import { buildSnippet } from '@/lib/services/search-snippet'
import { createClient } from '@/lib/supabase/server'
import { searchQuerySchema } from '@/lib/validations/search'
import { requireUser } from './utils'

export type SearchResult = {
  id: string
  title: string
  icon: string | null
  updatedAt: string
  snippet: string
}

export async function searchPages(
  query: string,
  cursor?: string
): Promise<{ data: SearchResult[]; nextCursor?: string; error?: string }> {
  // 1. 認証
  const auth = await requireUser()
  if ('error' in auth) return { data: [], error: auth.error }
  const { userId } = auth

  // 2. Zod バリデーション。トリム後に空になるクエリは早期 return（DB に飛ばさない）
  const parsed = searchQuerySchema.safeParse({ query, cursor })
  if (!parsed.success) {
    const trimmed = query.trim()
    if (trimmed.length === 0) return { data: [] }
    return { data: [], error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { query: trimmedQuery, cursor: cursorValue } = parsed.data

  // 空文字列はトリム後に保証される（schema.min(1) + transform(trim) の組み合わせで
  // 空白のみ文字列を弾く。この分岐は min(1) 違反を上の error ケースが処理済み）
  if (trimmedQuery.length === 0) return { data: [] }

  const supabase = await createClient()

  // 3. 検索クエリ構築。
  // .eq('user_id', userId) は RLS の owner_select に加えた多層防御。
  // ILIKE '%q%' は pg_trgm の GIN インデックス（pages_search_trgm_idx）が効く。
  // title と content_text を OR 検索する（search_text 生成列は全文でなく ILIKE に利用）。
  const likePattern = `%${trimmedQuery}%`

  let queryBuilder = supabase
    .from('pages')
    .select('id, title, icon, content_text, updated_at')
    .eq('user_id', userId)
    .eq('is_trashed', false)
    .or(`title.ilike.${likePattern},content_text.ilike.${likePattern}`)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(SEARCH_PAGE_SIZE)

  if (cursorValue) {
    queryBuilder = queryBuilder.lt('updated_at', cursorValue)
  }

  const { data, error } = await queryBuilder

  if (error) return { data: [], error: ERR_DB }

  const rows = data ?? []

  const items: SearchResult[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    icon: row.icon,
    updatedAt: row.updated_at,
    snippet: buildSnippet(row.content_text, trimmedQuery),
  }))

  const nextCursor =
    rows.length === SEARCH_PAGE_SIZE
      ? (rows[rows.length - 1]?.updated_at ?? undefined)
      : undefined

  return { data: items, nextCursor }
}
