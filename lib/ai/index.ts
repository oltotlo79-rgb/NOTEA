/**
 * @module lib/ai/index
 * プロバイダディスパッチ層。登録済みプロバイダを自動選択して generate を呼ぶ。
 * 優先順: 最後に使ったプロバイダ → 登録済みの最初のもの。
 */

import type { AiProvider } from '@/lib/constants/limits/ai'
import { AI_PROVIDERS } from '@/lib/constants/limits/ai'
import type { GenerateParams, AiGenerateResult } from '@/lib/ai/types'
import { getKey, hasKey } from '@/lib/ai/key-storage'

const LAST_USED_PROVIDER_KEY = 'notea_ai_last_provider'

export function getLastUsedProvider(): AiProvider | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(LAST_USED_PROVIDER_KEY)
  if (stored && (AI_PROVIDERS as readonly string[]).includes(stored)) {
    return stored as AiProvider
  }
  return null
}

export function setLastUsedProvider(provider: AiProvider): void {
  localStorage.setItem(LAST_USED_PROVIDER_KEY, provider)
}

/** 登録済みプロバイダを自動選択する */
export function selectProvider(): AiProvider | null {
  const last = getLastUsedProvider()
  if (last && hasKey(last)) return last

  for (const provider of AI_PROVIDERS) {
    if (hasKey(provider)) return provider
  }
  return null
}

export async function generateWithSelectedProvider(
  params: GenerateParams
): Promise<{ provider: AiProvider; result: AiGenerateResult } | { error: 'no_key' }> {
  const provider = selectProvider()
  if (!provider) return { error: 'no_key' }

  const key = getKey(provider)
  if (!key) return { error: 'no_key' }

  setLastUsedProvider(provider)

  // プロバイダモジュールを動的 import（バンドルに全 provider を含めない）
  let result: AiGenerateResult
  if (provider === 'gemini') {
    const mod = await import('@/lib/ai/providers/gemini')
    result = await mod.generate(params, key)
  } else if (provider === 'anthropic') {
    const mod = await import('@/lib/ai/providers/anthropic')
    result = await mod.generate(params, key)
  } else {
    const mod = await import('@/lib/ai/providers/openai')
    result = await mod.generate(params, key)
  }

  return { provider, result }
}
