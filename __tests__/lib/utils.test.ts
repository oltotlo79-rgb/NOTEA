import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('クラス名を結合し Tailwind の競合を解決する', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-sm', undefined, 'font-bold')).toBe('text-sm font-bold')
  })
})
