/**
 * @module app/api/cron/cleanup-trash
 * ごみ箱保持期間（TRASH_RETENTION_DAYS）を超えたページを完全削除する Cron ジョブ。
 *
 * Vercel Cron から毎日 00:00 UTC に呼び出される。
 * admin クライアントを使用する（ユーザーセッションが存在しないため）。
 * Storage の画像は DB 削除前に明示的に削除する（cascade 対象外のため）。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { TRASH_RETENTION_DAYS } from '@/lib/constants/limits'
import { ERR_CRON_DB_DELETE, ERR_CRON_DB_FETCH, ERR_CRON_UNAUTHORIZED } from '@/lib/constants/errors'

const NO_STORE = { 'Cache-Control': 'no-store' }

type PageRow = {
  id: string
  user_id: string
}

function isPageRow(value: unknown): value is PageRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).user_id === 'string'
  )
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Cron 認証（Bearer CRON_SECRET）
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: ERR_CRON_UNAUTHORIZED },
      { status: 401, headers: NO_STORE }
    )
  }

  const admin = createAdminClient()

  // 2. 対象ページを取得する（is_trashed=true かつ trashed_at が保持期間超過）
  //    now() - TRASH_RETENTION_DAYS 日より古いものを削除対象とする
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS)

  const { data: pages, error: fetchError } = await admin
    .from('pages')
    .select('id, user_id')
    .eq('is_trashed', true)
    .lt('trashed_at', cutoff.toISOString())

  if (fetchError) {
    return NextResponse.json(
      { error: ERR_CRON_DB_FETCH },
      { status: 500, headers: NO_STORE }
    )
  }

  const rows = Array.isArray(pages) ? pages.filter(isPageRow) : []

  if (rows.length === 0) {
    return NextResponse.json({ deleted: 0 }, { headers: NO_STORE })
  }

  // 3. 各ページの Storage 画像を削除する
  //    path 構造: {userId}/{pageId}/{filename}
  for (const row of rows) {
    const prefix = `${row.user_id}/${row.id}`
    const { data: files } = await admin.storage.from('page-images').list(prefix)
    if (files && files.length > 0) {
      const paths = files.map((f) => `${prefix}/${f.name}`)
      await admin.storage.from('page-images').remove(paths)
    }
  }

  // 4. ページを DB から削除する（cascade で子ページも削除される）
  const ids = rows.map((r) => r.id)
  const { error: deleteError } = await admin
    .from('pages')
    .delete()
    .in('id', ids)

  if (deleteError) {
    return NextResponse.json(
      { error: ERR_CRON_DB_DELETE },
      { status: 500, headers: NO_STORE }
    )
  }

  return NextResponse.json({ deleted: ids.length }, { headers: NO_STORE })
}
