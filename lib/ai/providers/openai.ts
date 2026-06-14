/**
 * @module lib/ai/providers/openai
 * OpenAI API は CORS 非対応のため /api/ai/proxy 経由でリクエストする。
 * 鍵は Authorization ヘッダで proxy に送り、proxy がプロバイダへ転送・破棄する。
 * Server Action（consumeAiUsage）は呼ばない: proxy が内部で消費するため二重カウントになる。
 *
 * OpenAI で形式チェックのみ（テスト呼び出しなし）とする理由:
 * CORS 非対応のため proxy を通じて呼ぶと consumeAiUsage が消費されてしまう。
 * proxy を通さない方法（/v1/models など）はすべてブラウザから直接呼べない。
 */

import type { GenerateParams, AiGenerateResult } from '@/lib/ai/types'
import { buildSummarize, buildContinue, buildTranslate, buildAsk } from '@/lib/ai/prompts'
import { AI_DEFAULT_MODELS, AI_MAX_INPUT_CHARS } from '@/lib/constants/ai'

function buildMessages(params: GenerateParams): { role: 'user'; content: string }[] {
  const text = params.text.slice(0, AI_MAX_INPUT_CHARS)
  let prompt: string
  switch (params.operation) {
    case 'summarize':
      prompt = buildSummarize(text)
      break
    case 'continue':
      prompt = buildContinue(text)
      break
    case 'translate':
      prompt = buildTranslate(text, params.sourceLang ?? '日本語', params.targetLang ?? '英語')
      break
    case 'ask':
      prompt = buildAsk(text, params.question ?? '')
      break
  }
  return [{ role: 'user', content: prompt }]
}

export async function generate(
  params: GenerateParams,
  key: string
): Promise<AiGenerateResult> {
  const messages = buildMessages(params)

  let response: Response
  try {
    response = await fetch('/api/ai/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        path: '/v1/chat/completions',
        model: AI_DEFAULT_MODELS.openai,
        stream: true,
        messages,
      }),
      signal: params.signal,
    })
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return {
        ok: false,
        error: { kind: 'network', message: '中断されました' },
      }
    }
    return {
      ok: false,
      error: { kind: 'network', message: 'ネットワークエラーが発生しました' },
    }
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: { kind: 'key_invalid', message: 'API キーが無効または許可されていません' },
    }
  }
  if (response.status === 429) {
    return {
      ok: false,
      error: { kind: 'rate_limited', message: 'レート制限に達しました' },
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      error: { kind: 'unknown', message: `API エラー: ${response.status}` },
    }
  }

  if (!response.body) {
    return {
      ok: false,
      error: { kind: 'unknown', message: 'レスポンスボディがありません' },
    }
  }

  const stream = new ReadableStream<string>({
    async start(controller) {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed: unknown = JSON.parse(data)
              if (
                typeof parsed === 'object' &&
                parsed !== null &&
                'choices' in parsed
              ) {
                const choicesRaw = (parsed as Record<string, unknown>)['choices']
                if (!Array.isArray(choicesRaw)) continue
                const first: unknown = choicesRaw[0]
                if (
                  typeof first === 'object' &&
                  first !== null &&
                  'delta' in first
                ) {
                  const delta = (first as Record<string, unknown>)['delta']
                  if (
                    typeof delta === 'object' &&
                    delta !== null &&
                    'content' in delta &&
                    typeof (delta as Record<string, unknown>)['content'] === 'string'
                  ) {
                    controller.enqueue((delta as Record<string, string>)['content'])
                  }
                }
              }
            } catch {
              // JSON パース失敗は無視
            }
          }
        }
      } catch {
        // ストリーム読み取りエラーは静かに終了
      } finally {
        controller.close()
      }
    },
  })

  return { ok: true, stream }
}
