/**
 * @module app/api/ai/proxy
 * OpenAI API のパススルールート。
 *
 * OpenAI は CORS 非対応のためブラウザから直接呼べない。
 * このルートがリクエストを受けて OpenAI 公式 API へ転送する。
 *
 * セキュリティ上の厳守事項（ai-byok.md）:
 * - 鍵は Authorization ヘッダで受けてそのまま転送し、変数に保持しない。
 * - 鍵・プロンプト・応答をログ/DB/キャッシュに残さない（Cache-Control: no-store）。
 * - Sentry 等の監視に鍵が乗らないよう、エラー時もヘッダ・ボディを記録しない。
 * - 転送先は AI_PROVIDER_API_ORIGINS の OpenAI ドメインのみ（SSRF 防止）。
 * - 認証済みユーザーのみ利用可。
 * - 転送前に consumeAiUsage で回数を消費する（成功後に呼ぶと二重カウントになる）。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { consumeAiUsage } from '@/lib/services/usage'
import { AI_PROVIDER_API_ORIGINS } from '@/lib/constants/security'
import {
  ERR_AUTH_REQUIRED,
  ERR_AI_PROXY_FORBIDDEN,
  ERR_AI_PROVIDER_NOT_ALLOWED,
  ERR_AI_LIMIT_REACHED,
  ERR_AI_FAILED,
} from '@/lib/constants/errors'
import { FREE_AI_DAILY_LIMIT } from '@/lib/constants/limits/ai'

const OPENAI_ORIGIN = 'https://api.openai.com'

/** リクエストボディで指定された転送先パスが allowlist 内か検証する */
function buildAllowedOpenAiUrl(path: string): URL | null {
  // path は '/v1/chat/completions' 等の形式を期待する
  if (!path.startsWith('/')) return null
  const candidate = `${OPENAI_ORIGIN}${path}`
  try {
    const url = new URL(candidate)
    // allowlist に含まれ、かつ OpenAI オリジンであることを確認する
    if (!AI_PROVIDER_API_ORIGINS.includes(OPENAI_ORIGIN)) return null
    if (url.origin !== OPENAI_ORIGIN) return null
    return url
  } catch {
    return null
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // キャッシュ禁止: 鍵・プロンプト・応答を中間層に残さない
  const noStore = { 'Cache-Control': 'no-store' }

  // 1. 認証（getUser はサーバー側で JWT 検証するため getSession より安全）
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: ERR_AUTH_REQUIRED }, { status: 401, headers: noStore })
  }

  // 2. 転送先パスを取得して allowlist 検証（SSRF 防止）
  let targetPath: string
  try {
    const body = (await request.clone().json()) as unknown
    if (
      typeof body !== 'object' ||
      body === null ||
      !('path' in body) ||
      typeof (body as Record<string, unknown>).path !== 'string'
    ) {
      return NextResponse.json(
        { error: ERR_AI_PROXY_FORBIDDEN },
        { status: 400, headers: noStore }
      )
    }
    targetPath = (body as { path: string }).path
  } catch {
    return NextResponse.json({ error: ERR_AI_PROXY_FORBIDDEN }, { status: 400, headers: noStore })
  }

  const targetUrl = buildAllowedOpenAiUrl(targetPath)
  if (!targetUrl) {
    return NextResponse.json({ error: ERR_AI_PROXY_FORBIDDEN }, { status: 403, headers: noStore })
  }

  // 3. 転送前に回数消費（消費後に転送することで二重カウントを防ぐ）
  const usageResult = await consumeAiUsage(user.id, 'openai')
  if ('code' in usageResult) {
    if (usageResult.code === 'PROVIDER_NOT_ALLOWED') {
      return NextResponse.json(
        { error: ERR_AI_PROVIDER_NOT_ALLOWED },
        { status: 403, headers: noStore }
      )
    }
    if (usageResult.code === 'LIMIT_EXCEEDED') {
      // プランから上限値を特定してエラーメッセージに含める
      const limitMatch = usageResult.message.match(/上限（(\d+)回）/)
      const limitNum =
        limitMatch?.[1] !== undefined ? parseInt(limitMatch[1], 10) : FREE_AI_DAILY_LIMIT
      return NextResponse.json(
        { error: ERR_AI_LIMIT_REACHED(limitNum) },
        { status: 429, headers: noStore }
      )
    }
    return NextResponse.json({ error: ERR_AI_FAILED }, { status: 500, headers: noStore })
  }

  // 4. OpenAI API へ転送
  // Authorization ヘッダをそのまま転送し、このスコープ外に変数として保持しない。
  // エラー時も Authorization の値をログ・例外メッセージに含めない。
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return NextResponse.json(
      { error: ERR_AUTH_REQUIRED },
      { status: 401, headers: noStore }
    )
  }

  const forwardHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: authHeader,
  }

  // クライアントが指定した Content-Type を引き継ぐ（multipart 等）
  const clientContentType = request.headers.get('Content-Type')
  if (clientContentType) {
    forwardHeaders['Content-Type'] = clientContentType
  }

  let upstream: Response
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: forwardHeaders,
      body: request.body,
      // @ts-expect-error -- Node.js fetch では duplex が必要（ストリームボディ転送）
      duplex: 'half',
    })
  } catch {
    // ネットワークエラー時は鍵・ボディを含まない汎用エラーのみ返す
    return NextResponse.json({ error: ERR_AI_FAILED }, { status: 502, headers: noStore })
  }

  // 5. レスポンスをそのまま返す（鍵はレスポンスに含まれない）
  const responseHeaders = new Headers(noStore)
  const upstreamContentType = upstream.headers.get('Content-Type')
  if (upstreamContentType) {
    responseHeaders.set('Content-Type', upstreamContentType)
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}
