import { Fragment } from 'react'

type HighlightedTextProps = {
  text: string
  query: string
}

/**
 * text 内の query 一致部分を <mark> で強調する。
 * dangerouslySetInnerHTML を使わず、文字列分割 + React 要素で組むため XSS の経路が無い。
 * 大小文字を無視して一致させ、元テキストの表記は保持する。
 */
export function HighlightedText({ text, query }: HighlightedTextProps) {
  const trimmed = query.trim()
  if (!trimmed) return <>{text}</>

  const lowerText = text.toLowerCase()
  const lowerQuery = trimmed.toLowerCase()

  const segments: Array<{ value: string; match: boolean }> = []
  let cursor = 0

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, cursor)
    if (matchIndex === -1) {
      segments.push({ value: text.slice(cursor), match: false })
      break
    }
    if (matchIndex > cursor) {
      segments.push({ value: text.slice(cursor, matchIndex), match: false })
    }
    segments.push({ value: text.slice(matchIndex, matchIndex + trimmed.length), match: true })
    cursor = matchIndex + trimmed.length
  }

  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index} className="bg-yellow-200 text-foreground rounded-sm dark:bg-yellow-500/40">
            {segment.value}
          </mark>
        ) : (
          <Fragment key={index}>{segment.value}</Fragment>
        )
      )}
    </>
  )
}
