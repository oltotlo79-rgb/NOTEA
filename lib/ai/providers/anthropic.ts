/**
 * @module lib/ai/providers/anthropic
 * Anthropic API をブラウザから直接呼び出す。
 * anthropic-dangerous-direct-browser-access ヘッダが必要（CORS 対応の明示的な許可）。
 */

import type { GenerateParams, AiGenerateResult } from '@/lib/ai/types'
import { buildSummarize, buildContinue, buildTranslate, buildAsk } from '@/lib/ai/prompts'
import { AI_DEFAULT_MODELS, AI_MAX_INPUT_CHARS } from '@/lib/constants/ai'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_API_VERSION = '2023-06-01'

function buildPrompt(params: GenerateParams): string {
  const text = params.text.slice(0, AI_MAX_INPUT_CHARS)
  switch (params.operation) {
    case 'summarize':
      return buildSummarize(text)
    case 'continue':
      return buildContinue(text)
    case 'translate':
      return buildTranslate(text, params.sourceLang ?? '日本語', params.targetLang ?? '英語')
    case 'ask':
      return buildAsk(text, params.question ?? '')
  }
}

export async function generate(
  params: GenerateParams,
  key: string
): Promise<AiGenerateResult> {
  const prompt = buildPrompt(params)

  let response: Response
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_API_VERSION,
        // Anthropic はこのヘッダが無いとブラウザ直接呼び出しを CORS で拒否する
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: AI_DEFAULT_MODELS.anthropic,
        max_tokens: 2048,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
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
      error: { kind: 'key_invalid', message: 'API キーが無効です' },
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
                'type' in parsed &&
                (parsed as Record<string, unknown>).type === 'content_block_delta' &&
                'delta' in parsed
              ) {
                const delta = (parsed as Record<string, unknown>).delta
                if (
                  typeof delta === 'object' &&
                  delta !== null &&
                  'type' in delta &&
                  (delta as Record<string, unknown>).type === 'text_delta' &&
                  'text' in delta &&
                  typeof (delta as Record<string, unknown>).text === 'string'
                ) {
                  controller.enqueue((delta as Record<string, string>).text)
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
