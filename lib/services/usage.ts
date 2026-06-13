/**
 * @module lib/services/usage
 * ユーザーリソース使用量の取得ロジック。
 * images action と settings ページの双方から共有する。
 * 認証は呼び出し元（Action 層）が済ませている前提。
 */

import { FREE_MAX_STORAGE_MB, PAID_MAX_STORAGE_GB } from '@/lib/constants/limits'
import { createClient } from '@/lib/supabase/server'

const BYTES_PER_MB = 1024 * 1024
const BYTES_PER_GB = 1024 * 1024 * 1024

async function getUserPlan(userId: string): Promise<'free' | 'paid'> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('plan').eq('id', userId).maybeSingle()
  return data?.plan === 'paid' ? 'paid' : 'free'
}

/**
 * ユーザーの Storage 使用量とプラン上限を返す。
 * `page-images` バケットの `{userId}/` 配下を page_id フォルダ単位で集計する。
 * Storage.list はフォルダ単位で再帰せず、page_id プレフィックス一覧を取得してから
 * 各フォルダの中身をリストする二段階方式を採る（Storage にサブフォルダ深度制約があるため）。
 */
export async function getStorageUsage(
  userId: string
): Promise<{ usedBytes: number; limitBytes: number }> {
  const supabase = await createClient()
  const plan = await getUserPlan(userId)

  const limitBytes =
    plan === 'paid'
      ? PAID_MAX_STORAGE_GB * BYTES_PER_GB
      : FREE_MAX_STORAGE_MB * BYTES_PER_MB

  // {userId}/ 直下のフォルダ（page_id 名）を列挙する
  const { data: folders } = await supabase.storage.from('page-images').list(userId)
  if (!folders || folders.length === 0) {
    return { usedBytes: 0, limitBytes }
  }

  let usedBytes = 0
  for (const folder of folders) {
    const prefix = `${userId}/${folder.name}`
    const { data: files } = await supabase.storage.from('page-images').list(prefix)
    if (!files) continue
    for (const file of files) {
      // metadata.size は Storage の list が返すファイルサイズ（バイト）
      usedBytes += (file.metadata as { size?: number } | null)?.size ?? 0
    }
  }

  return { usedBytes, limitBytes }
}
