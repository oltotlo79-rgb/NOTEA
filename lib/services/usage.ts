/**
 * @module lib/services/usage
 * ユーザーリソース使用量の取得ロジック。
 * images action と settings ページの双方から共有する。
 * 認証は呼び出し元（Action 層）が済ませている前提。
 *
 * consumeAiUsage / getAiUsageToday は AI 回数管理を担う。
 * ユーザーの API キーは一切扱わない（鍵は lib/ai/ 層にのみ存在する）。
 */

import {
  AI_PROVIDERS,
  FREE_AI_DAILY_LIMIT,
  FREE_AI_PROVIDERS,
  PAID_AI_DAILY_LIMIT,
  type AiProvider,
} from '@/lib/constants/limits/ai'
import { FREE_MAX_STORAGE_MB, PAID_MAX_STORAGE_GB } from '@/lib/constants/limits'
import { createClient } from '@/lib/supabase/server'

const BYTES_PER_MB = 1024 * 1024
const BYTES_PER_GB = 1024 * 1024 * 1024

async function getUserPlan(userId: string): Promise<'free' | 'paid'> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('plan').eq('id', userId).maybeSingle()
  return data?.plan === 'paid' ? 'paid' : 'free'
}

/** JST 基準の今日の日付文字列（YYYY-MM-DD）を返す */
function getTodayJst(): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/\//g, '-')
}

function isFileMetadata(value: unknown): value is { size?: number } {
  return typeof value === 'object' && value !== null
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
      usedBytes += isFileMetadata(file.metadata) ? (file.metadata.size ?? 0) : 0
    }
  }

  return { usedBytes, limitBytes }
}

/** consumeAiUsage で返す判別可能なエラー種別 */
export type AiUsageError =
  | { code: 'PROVIDER_NOT_ALLOWED'; message: string }
  | { code: 'LIMIT_EXCEEDED'; message: string }
  | { code: 'DB_ERROR'; message: string }

/**
 * AI 利用回数をアトミックに消費する。
 *
 * - 無料プランは FREE_AI_PROVIDERS（Gemini のみ）以外は即座に PROVIDER_NOT_ALLOWED。
 * - rpc consume_ai_usage は上限超過時に PostgreSQL 例外を throw する設計（M1 実装済み）。
 *   例外メッセージに 'AI_LIMIT_EXCEEDED' が含まれる場合を LIMIT_EXCEEDED として判別する。
 * - throw するのでなく AiUsageError を返す（呼び出し側が try/catch 不要になるため）。
 *
 * 二重カウント防止:
 *   Gemini/Anthropic → Server Action consumeAiUsage を先に呼び、成功後にブラウザが直接 API 呼び出し。
 *   OpenAI → /api/ai/proxy が内部でこの関数を呼んでから転送（Server Action は経由しない）。
 *   どちらの経路でも 1 provider 1 リクエストにつき 1 回だけ消費される。
 */
export async function consumeAiUsage(
  userId: string,
  provider: AiProvider
): Promise<{ remaining: number } | AiUsageError> {
  const plan = await getUserPlan(userId)
  const limit = plan === 'paid' ? PAID_AI_DAILY_LIMIT : FREE_AI_DAILY_LIMIT

  if (plan !== 'paid' && !(FREE_AI_PROVIDERS as readonly AiProvider[]).includes(provider)) {
    return {
      code: 'PROVIDER_NOT_ALLOWED',
      message:
        'このプロバイダは有料プランでのみ利用できます。無料プランでは Gemini のみ使用可能です',
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('consume_ai_usage', {
    p_provider: provider,
    p_limit: limit,
  })

  if (error) {
    if (error.message.includes('AI_LIMIT_EXCEEDED')) {
      return {
        code: 'LIMIT_EXCEEDED',
        message: `AI の利用回数が本日の上限（${limit}回）に達しました。明日（JST 0時以降）再度ご利用ください`,
      }
    }
    return { code: 'DB_ERROR', message: 'データの読み書きに失敗しました。時間をおいて再試行してください' }
  }

  // rpc は消費後の count を返す
  const consumed = typeof data === 'number' ? data : limit
  const remaining = Math.max(0, limit - consumed)
  return { remaining }
}

/**
 * ユーザーのページ数を返す。
 * count_user_pages rpc はセッション中のユーザーを参照するため、
 * 呼び出し前に認証が完了していることを呼び出し元が保証する。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- userId は count_user_pages rpc がセッション経由で参照するため直接渡さない
export async function getPageCount(userId: string): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('count_user_pages')
  if (error || data === null) return 0
  // rpc の戻り値型: number
  return typeof data === 'number' ? data : 0
}

/** provider 別の ai_usage 行を表す型（database.ts の Row から最小カラム） */
type AiUsageRow = { provider: string; count: number }

/** provider ごとの集計 */
type AiProviderUsage = {
  provider: AiProvider
  count: number
  remaining: number
  limit: number
}

/**
 * 本日（JST）の AI 利用状況を provider 別に集計して返す。
 * 設定画面・AI メニューの残回数表示から呼ばれる読み取り専用関数。
 */
export async function getAiUsageToday(userId: string): Promise<{
  providers: AiProviderUsage[]
  plan: 'free' | 'paid'
}> {
  const supabase = await createClient()
  const plan = await getUserPlan(userId)
  const limit = plan === 'paid' ? PAID_AI_DAILY_LIMIT : FREE_AI_DAILY_LIMIT
  const today = getTodayJst()

  const { data } = await supabase
    .from('ai_usage')
    .select('provider, count')
    .eq('user_id', userId)
    .eq('used_on', today)

  const rows: AiUsageRow[] = Array.isArray(data) ? data : []

  const providers = AI_PROVIDERS.map((provider) => {
    const row = rows.find((r) => r.provider === provider)
    const count = row?.count ?? 0
    return {
      provider,
      count,
      remaining: Math.max(0, limit - count),
      limit,
    }
  })

  return { providers, plan }
}
