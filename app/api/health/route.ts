/**
 * @module app/api/health
 * DB 接続確認エンドポイント。
 * 認証不要・公開。秘密情報は一切返さない。
 * Vercel / 監視サービスからのヘルスチェックに使用する。
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(): Promise<NextResponse> {
  try {
    const admin = createAdminClient()
    // profiles テーブルへの軽いクエリで DB 接続を確認する
    // head: true を使うことでデータ転送を最小化する
    const { error } = await admin.from('profiles').select('id', { count: 'exact', head: true })
    if (error) {
      return NextResponse.json({ status: 'error' }, { status: 503, headers: NO_STORE })
    }
    return NextResponse.json({ status: 'ok' }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503, headers: NO_STORE })
  }
}
