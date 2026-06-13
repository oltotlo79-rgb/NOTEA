/**
 * @module lib/queries/pages
 * RSC（Server Component）専用のページ取得キャッシュ層。
 * React cache() でリクエスト内重複取得を防ぎ、RLS + user_id 二重チェックで防御する。
 */
import 'server-only'
import { cache } from 'react'
import { PAGE_DETAIL_SELECT } from '@/lib/supabase/shared-selects'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

// PAGE_DETAIL_SELECT に対応するカラムのみ含む型
export type PageDetail = Pick<
  Tables<'pages'>,
  'id' | 'parent_id' | 'title' | 'icon' | 'content' | 'content_text' | 'updated_at' | 'is_trashed'
>

export const getPage = cache(async (id: string): Promise<PageDetail | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('pages')
    .select(PAGE_DETAIL_SELECT)
    .eq('id', id)
    // defense in depth: RLS に加えてサーバー側でも所有者を検証
    .eq('user_id', user.id)
    .eq('is_trashed', false)
    .maybeSingle()

  return data
})

export const getMostRecentPageId = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('pages')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_trashed', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.id ?? null
})
