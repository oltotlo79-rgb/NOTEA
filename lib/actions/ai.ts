/**
 * @module lib/actions/ai
 * AI 利用回数の消費・照会を行う Server Actions。
 *
 * セキュリティ上の制約:
 * - 引数に API キーを受け取らない（鍵は lib/ai/ 層にのみ存在する）。
 * - 消費ロジックは lib/services/usage.consumeAiUsage に委譲する。
 * - プロンプト・応答は引数・戻り値に含まれない。
 *
 * getAiUsageToday は ActionResult ではなくカスタム形状を返す。
 * 設定・AI メニューで空状態がデフォルト表示として自然であり、
 * error フィールドを別フィールドで返すことで呼び出し側が簡潔になるため。
 */

'use server'

import { z } from 'zod'
import { AI_PROVIDERS, type AiProvider } from '@/lib/constants/limits/ai'
import {
  ERR_AI_FAILED,
  ERR_AI_LIMIT_REACHED,
  ERR_AI_PROVIDER_NOT_ALLOWED,
  ERR_AUTH_REQUIRED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import { requireUser } from '@/lib/actions/utils'
import {
  consumeAiUsage as serviceConsumeAiUsage,
  getAiUsageToday as serviceGetAiUsageToday,
} from '@/lib/services/usage'
import { actionError, actionSuccess, type ActionResult } from '@/types/action-result'

import { FREE_AI_DAILY_LIMIT, PAID_AI_DAILY_LIMIT } from '@/lib/constants/limits/ai'

const consumeAiUsageSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
})

/**
 * AI 利用回数をアトミックに消費する Server Action。
 *
 * Gemini / Anthropic の利用フロー:
 *   1. クライアントがこの Action を呼んで成功を確認する
 *   2. 成功後にブラウザが lib/ai/providers/{provider}.ts で直接 API を呼ぶ
 *
 * OpenAI の利用フロー:
 *   /api/ai/proxy が内部で serviceConsumeAiUsage を直接呼ぶため、
 *   OpenAI のときはこの Action を経由しない（二重カウント防止）。
 *
 * 引数型に apiKey 等のフィールドは存在しない。鍵はサーバーを通らない。
 */
export async function consumeAiUsage(
  provider: AiProvider
): Promise<ActionResult<{ remaining: number }>> {
  // 1. 認証
  const authResult = await requireUser()
  if ('error' in authResult) return actionError<{ remaining: number }>(ERR_AUTH_REQUIRED)

  // 2. Zod バリデーション
  const parsed = consumeAiUsageSchema.safeParse({ provider })
  if (!parsed.success) return actionError<{ remaining: number }>(ERR_INVALID_INPUT)

  // 3. 制限チェック + 消費（services 層に委譲）
  const result = await serviceConsumeAiUsage(authResult.userId, parsed.data.provider)

  if ('code' in result) {
    if (result.code === 'PROVIDER_NOT_ALLOWED') {
      return actionError<{ remaining: number }>(ERR_AI_PROVIDER_NOT_ALLOWED)
    }
    if (result.code === 'LIMIT_EXCEEDED') {
      const limitMatch = result.message.match(/上限（(\d+)回）/)
      const limitNum =
        limitMatch?.[1] !== undefined ? parseInt(limitMatch[1], 10) : FREE_AI_DAILY_LIMIT
      return actionError<{ remaining: number }>(ERR_AI_LIMIT_REACHED(limitNum))
    }
    return actionError<{ remaining: number }>(ERR_AI_FAILED)
  }

  return actionSuccess({ remaining: result.remaining })
}

/** provider 別の利用状況 */
type AiProviderUsage = {
  provider: AiProvider
  count: number
  remaining: number
  limit: number
}

/**
 * 本日（JST）の AI 利用状況を返す。
 * 設定画面・AI メニューの残回数表示から呼ばれる。
 *
 * Returns custom shape instead of ActionResult because
 * 残回数 0 が正常状態として自然であり、error は別フィールドで返すことで
 * 呼び出し側が空配列フォールバックを簡潔に書けるため。
 */
export async function getAiUsageToday(): Promise<{
  providers: AiProviderUsage[]
  plan: 'free' | 'paid'
  limit: number
  error?: string
}> {
  const authResult = await requireUser()
  if ('error' in authResult) {
    return {
      providers: [],
      plan: 'free',
      limit: FREE_AI_DAILY_LIMIT,
      error: ERR_AUTH_REQUIRED,
    }
  }

  const result = await serviceGetAiUsageToday(authResult.userId)
  const limit = result.plan === 'paid' ? PAID_AI_DAILY_LIMIT : FREE_AI_DAILY_LIMIT

  return {
    providers: result.providers,
    plan: result.plan,
    limit,
  }
}
