import { describe, expect, it } from 'vitest'
import { buildSnippet } from '@/lib/services/search-snippet'
import { SNIPPET_LENGTH } from '@/lib/constants/limits'

describe('buildSnippet', () => {
  it('空の content_text は空文字を返す', () => {
    expect(buildSnippet('', 'foo')).toBe('')
  })

  it('一致箇所周辺を抜粋する', () => {
    const text = 'a'.repeat(100) + '検索ワード' + 'b'.repeat(100)
    const snippet = buildSnippet(text, '検索ワード')
    expect(snippet).toContain('検索ワード')
    // 前後に省略記号が付く
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
  })

  it('一致がないときは先頭から抜粋する', () => {
    const text = 'x'.repeat(300)
    const snippet = buildSnippet(text, 'みつからない')
    expect(snippet.startsWith('x')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
  })

  it('短い content はそのまま返す（一致なし）', () => {
    expect(buildSnippet('短い本文', 'なし')).toBe('短い本文')
  })

  it('大小文字を無視して一致させる', () => {
    const snippet = buildSnippet('Hello React World', 'react')
    expect(snippet).toContain('React')
  })

  it('結果は SNIPPET_LENGTH 文字以内に収まる（省略記号分の余裕を許容）', () => {
    const text = 'z'.repeat(1000)
    const snippet = buildSnippet(text, 'zzz')
    expect(snippet.length).toBeLessThanOrEqual(SNIPPET_LENGTH + 1)
  })

  it('一致が先頭にあるときは前方の省略記号を付けない', () => {
    const text = '検索ワード' + 'b'.repeat(100)
    const snippet = buildSnippet(text, '検索ワード')
    expect(snippet.startsWith('…')).toBe(false)
    expect(snippet.startsWith('検索ワード')).toBe(true)
  })
})
