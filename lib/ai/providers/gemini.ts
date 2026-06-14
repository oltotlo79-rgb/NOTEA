/**
 * @module lib/ai/providers/gemini
 * Gemini API をブラウザから直接呼び出す。CORS 対応済みのため proxy 不要。
 */

import type { GenerateParams, AiGenerateResult } from '@/lib/ai/types'
import { buildSummarize, buildContinue, buildTranslate, buildAsk } from '@/lib/ai/prompts'
import { AI_DEFAULT_MODELS } from '@/lib/constants/ai'
import { AI_MAX_INPUT_CHARS } from '@/lib/constants/ai'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

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
  const model = AI_DEFAULT_MODELS.gemini

  const url = `${GEMINI_API_BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
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
                'candidates' in parsed
              ) {
                const raw = parsed as Record<string, unknown>
                const candidatesRaw = raw['candidates']
                if (!Array.isArray(candidatesRaw)) continue
                const first: unknown = candidatesRaw[0]
                if (
                  typeof first === 'object' &&
                  first !== null &&
                  'content' in first
                ) {
                  const content = (first as Record<string, unknown>)['content']
                  if (
                    typeof content === 'object' &&
                    content !== null &&
                    'parts' in content
                  ) {
                    const partsRaw = (content as Record<string, unknown>)['parts']
                    if (!Array.isArray(partsRaw)) continue
                    for (const part of partsRaw) {
                      if (
                        typeof part === 'object' &&
                        part !== null &&
                        'text' in part &&
                        typeof (part as Record<string, unknown>)['text'] === 'string'
                      ) {
                        controller.enqueue((part as Record<string, string>)['text'])
                      }
                    }
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
