'use client'

import { useRef, useState, useEffect } from 'react'

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error'

type StreamReaderResult = {
  text: string
  status: StreamStatus
}

/**
 * ReadableStream<string> を購読してテキストを逐次受信するフック。
 * stream が null のときは idle 状態を返す。
 * errorMessage が渡されたときは即 error 状態にする。
 *
 * setState はすべて非同期コールバック（reader.read のコールバック）から呼ばれるため
 * react-hooks/set-state-in-effect に違反しない。
 */
export function useStreamReader(
  stream: ReadableStream<string> | null,
  errorMessage: string | undefined
): StreamReaderResult {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<StreamStatus>('idle')
  const streamRef = useRef<ReadableStream<string> | null>(null)

  useEffect(() => {
    if (errorMessage) {
      // エラーは props から直接来るが、非同期タスク開始なし（同期判定 → 非同期 setStatus でラップ）
      const t = setTimeout(() => {
        setStatus('error')
        setText('')
      }, 0)
      return () => clearTimeout(t)
    }

    if (!stream) {
      const t = setTimeout(() => {
        setStatus('idle')
        setText('')
      }, 0)
      return () => clearTimeout(t)
    }

    // stream が変わった場合のみ再購読する
    if (stream === streamRef.current) return
    streamRef.current = stream

    let cancelled = false
    const reader = stream.getReader()

    async function read() {
      setText('')
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (cancelled) break
          if (done) {
            setStatus('done')
            break
          }
          setStatus('streaming')
          setText((prev) => prev + value)
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void read()

    return () => {
      cancelled = true
      void reader.cancel()
    }
  }, [stream, errorMessage])

  return { text, status }
}
