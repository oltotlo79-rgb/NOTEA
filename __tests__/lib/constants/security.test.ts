import { describe, expect, it } from 'vitest'
import { AI_PROVIDER_API_ORIGINS } from '@/lib/constants/security'

describe('AI_PROVIDER_API_ORIGINS', () => {
  it('公式 3 プロバイダのオリジンのみを含む（BYOK の鍵送信先 allowlist）', () => {
    expect(AI_PROVIDER_API_ORIGINS).toEqual([
      'https://generativelanguage.googleapis.com',
      'https://api.openai.com',
      'https://api.anthropic.com',
    ])
  })
  it('すべて https である', () => {
    for (const origin of AI_PROVIDER_API_ORIGINS) {
      expect(origin.startsWith('https://')).toBe(true)
    }
  })
})
