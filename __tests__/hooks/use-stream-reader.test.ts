/**
 * hooks/use-stream-reader.ts のユニットテスト。
 * ReadableStream を購読してテキストを逐次受信するフックをテストする。
 */

import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStreamReader } from '@/hooks/use-stream-reader'

function makeTextStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      for (const chunk of chunks) {
        await Promise.resolve()
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

describe('useStreamReader', () => {
  it('初期状態: stream=null のとき idle ステータス、空テキスト', () => {
    const { result } = renderHook(() => useStreamReader(null, undefined))
    expect(result.current.status).toBe('idle')
    expect(result.current.text).toBe('')
  })

  it('errorMessage が渡されたとき error ステータスになる', async () => {
    const { result } = renderHook(() => useStreamReader(null, 'エラーが発生しました'))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(result.current.status).toBe('error')
    expect(result.current.text).toBe('')
  })

  it('stream が完了したとき done ステータスになる', async () => {
    const stream = makeTextStream(['Hello', ' World'])
    const { result } = renderHook(() => useStreamReader(stream, undefined))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200))
    })

    expect(result.current.status).toBe('done')
    expect(result.current.text).toContain('Hello')
    expect(result.current.text).toContain('World')
  })

  it('stream 受信中は streaming ステータスになる', async () => {
    let resolveChunk: () => void
    const blockingChunk = new Promise<void>((resolve) => {
      resolveChunk = resolve
    })

    const stream = new ReadableStream<string>({
      async start(controller) {
        controller.enqueue('first')
        await blockingChunk
        controller.enqueue('second')
        controller.close()
      },
    })

    const { result } = renderHook(() => useStreamReader(stream, undefined))

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    // streaming 状態であること
    expect(result.current.status).toBe('streaming')

    // チャンクを解放して完了させる
    act(() => {
      resolveChunk!()
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(result.current.status).toBe('done')
  })

  it('stream=null に戻ると idle ステータスに戻る', async () => {
    let currentStream: ReadableStream<string> | null = makeTextStream(['text'])
    const { result, rerender } = renderHook<ReturnType<typeof useStreamReader>, { s: ReadableStream<string> | null }>(
      ({ s }) => useStreamReader(s, undefined),
      { initialProps: { s: currentStream } }
    )

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200))
    })

    currentStream = null
    rerender({ s: null })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.text).toBe('')
  })
})
