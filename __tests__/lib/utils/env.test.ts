import { describe, expect, it } from 'vitest'
import { requireEnv } from '@/lib/utils/env'

describe('requireEnv', () => {
  it('値があればそのまま返す', () => {
    expect(requireEnv('value', 'KEY')).toBe('value')
  })
  it('undefined なら変数名入りで throw する', () => {
    expect(() => requireEnv(undefined, 'MY_KEY')).toThrow('MY_KEY')
  })
  it('空文字なら throw する', () => {
    expect(() => requireEnv('', 'MY_KEY')).toThrow('MY_KEY')
  })
})
