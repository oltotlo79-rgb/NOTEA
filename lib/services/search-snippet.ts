/**
 * @module lib/services/search-snippet
 * 検索結果スニペット（一致箇所周辺の抜粋）生成。サーバー専用。
 * クライアントに渡すのは生成済み文字列のみ（content_text 全体は送らない）。
 */

import { SNIPPET_CONTEXT, SNIPPET_LENGTH } from '@/lib/constants/limits'

/**
 * content_text からクエリ一致箇所の周辺を抜粋して返す。
 * 一致がない場合は先頭 SNIPPET_LENGTH 文字を返す。
 * 結果は必ず SNIPPET_LENGTH 文字以内に収める。
 */
export function buildSnippet(contentText: string, query: string): string {
  if (!contentText) return ''

  const lowerText = contentText.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const matchIndex = lowerText.indexOf(lowerQuery)

  if (matchIndex === -1) {
    // 一致なし: 先頭から SNIPPET_LENGTH 文字
    return contentText.length <= SNIPPET_LENGTH
      ? contentText
      : contentText.slice(0, SNIPPET_LENGTH) + '…'
  }

  // 一致箇所の前後 SNIPPET_CONTEXT 文字を切り出す
  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT)
  const end = Math.min(contentText.length, matchIndex + query.length + SNIPPET_CONTEXT)
  const excerpt = contentText.slice(start, end)

  const prefix = start > 0 ? '…' : ''
  const suffix = end < contentText.length ? '…' : ''
  const result = prefix + excerpt + suffix

  return result.length <= SNIPPET_LENGTH ? result : result.slice(0, SNIPPET_LENGTH) + '…'
}
