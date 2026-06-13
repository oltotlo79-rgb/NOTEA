import { describe, expect, it } from 'vitest'
import { displayTitle, UNTITLED } from '@/lib/utils/page-display'

describe('displayTitle', () => {
  it('通常のタイトルはそのまま返す', () => {
    expect(displayTitle('設計メモ')).toBe('設計メモ')
  })
  it.each(['', '   ', null, undefined])('空・空白・null・undefined は「無題」を返す (%s)', (value) => {
    expect(displayTitle(value)).toBe(UNTITLED)
  })
})
