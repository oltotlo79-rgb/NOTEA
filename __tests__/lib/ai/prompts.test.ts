/**
 * prompts.ts のユニットテスト。
 * 純関数のため副作用なし・モック不要。
 */

import { describe, expect, it } from 'vitest'
import { buildSummarize, buildContinue, buildTranslate, buildAsk } from '@/lib/ai/prompts'

describe('buildSummarize', () => {
  it('渡したテキストを含むプロンプトを返す', () => {
    const result = buildSummarize('テスト本文')
    expect(result).toContain('テスト本文')
  })

  it('要約指示文を含む', () => {
    const result = buildSummarize('サンプル')
    expect(result).toContain('要約')
  })

  it('空文字列でも例外を投げない', () => {
    expect(() => buildSummarize('')).not.toThrow()
  })

  it('文字列を返す', () => {
    expect(typeof buildSummarize('本文')).toBe('string')
  })
})

describe('buildContinue', () => {
  it('渡したテキストを含むプロンプトを返す', () => {
    const result = buildContinue('続き書きのテキスト')
    expect(result).toContain('続き書きのテキスト')
  })

  it('続きを書く指示文を含む', () => {
    const result = buildContinue('テキスト')
    expect(result).toContain('続き')
  })

  it('文字列を返す', () => {
    expect(typeof buildContinue('本文')).toBe('string')
  })
})

describe('buildTranslate', () => {
  it('渡したテキストを含むプロンプトを返す', () => {
    const result = buildTranslate('翻訳対象テキスト', '日本語', '英語')
    expect(result).toContain('翻訳対象テキスト')
  })

  it('元言語とターゲット言語を含む', () => {
    const result = buildTranslate('テキスト', '日本語', '英語')
    expect(result).toContain('日本語')
    expect(result).toContain('英語')
  })

  it('別の言語ペアでも機能する', () => {
    const result = buildTranslate('Text', '英語', 'フランス語')
    expect(result).toContain('英語')
    expect(result).toContain('フランス語')
  })

  it('文字列を返す', () => {
    expect(typeof buildTranslate('テキスト', '日本語', '英語')).toBe('string')
  })
})

describe('buildAsk', () => {
  it('ページテキストと質問を含むプロンプトを返す', () => {
    const result = buildAsk('ページ本文の内容', 'これは何ですか？')
    expect(result).toContain('ページ本文の内容')
    expect(result).toContain('これは何ですか？')
  })

  it('空のページテキストでも例外を投げない', () => {
    expect(() => buildAsk('', '質問文')).not.toThrow()
  })

  it('空ページテキストのとき「ページの内容はまだありません」を含む', () => {
    const result = buildAsk('', '何か質問')
    expect(result).toContain('ページの内容はまだありません')
  })

  it('ページテキストがある場合はページの内容を含む', () => {
    const result = buildAsk('重要な情報', '要点は何ですか？')
    expect(result).toContain('重要な情報')
    expect(result).toContain('要点は何ですか？')
  })

  it('文字列を返す', () => {
    expect(typeof buildAsk('本文', '質問')).toBe('string')
  })
})
