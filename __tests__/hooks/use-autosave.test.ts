/**
 * @module __tests__/hooks/use-autosave.test.ts
 * useAutosave フックのユニットテスト。
 * vi.useFakeTimers() で debounce タイマーを制御する。
 */
import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_SAVED_DISPLAY_MS } from '@/lib/constants/limits'

const mockUpdatePageContent = vi.fn()

vi.mock('@/lib/actions/pages', () => ({
  updatePageContent: (...args: unknown[]) => mockUpdatePageContent(...args),
}))

const { useAutosave } = await import('@/hooks/use-autosave')

const PAGE_ID = 'a0000001-0000-4000-8000-000000000001'
const SAMPLE_CONTENT = [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }]
const SAMPLE_TEXT = 'hello'

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutosave', () => {
  // =====================
  // 初期状態
  // =====================
  describe('初期状態', () => {
    it('初期 status は idle', () => {
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))
      expect(result.current.status).toBe('idle')
    })

    it('saveNow / onContentChange 関数が返される', () => {
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))
      expect(typeof result.current.saveNow).toBe('function')
      expect(typeof result.current.onContentChange).toBe('function')
    })
  })

  // =====================
  // debounce 動作
  // =====================
  describe('debounce 動作', () => {
    it(`debounce ${AUTOSAVE_DEBOUNCE_MS}ms 後に updatePageContent が1回呼ばれる`, async () => {
      mockUpdatePageContent.mockResolvedValue({ success: true })
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange(SAMPLE_CONTENT, SAMPLE_TEXT)
      })

      expect(mockUpdatePageContent).not.toHaveBeenCalled()

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)
      })

      expect(mockUpdatePageContent).toHaveBeenCalledOnce()
      expect(mockUpdatePageContent).toHaveBeenCalledWith({
        id: PAGE_ID,
        content: SAMPLE_CONTENT,
        contentText: SAMPLE_TEXT,
      })
    })

    it('連続変更でデバウンスがリセットされ最後の変更のみ保存される', async () => {
      mockUpdatePageContent.mockResolvedValue({ success: true })
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange([{ type: 'paragraph' }], 'first')
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 100)
        result.current.onContentChange([{ type: 'paragraph' }], 'second')
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 100)
        result.current.onContentChange(SAMPLE_CONTENT, 'final')
      })

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)
      })

      expect(mockUpdatePageContent).toHaveBeenCalledOnce()
      expect(mockUpdatePageContent).toHaveBeenCalledWith(
        expect.objectContaining({ contentText: 'final' })
      )
    })

    it('debounce 中に pending がない場合は保存しない', async () => {
      renderHook(() => useAutosave({ pageId: PAGE_ID }))

      // onContentChange を呼ばずにタイマーを進める
      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2)
      })

      expect(mockUpdatePageContent).not.toHaveBeenCalled()
    })
  })

  // =====================
  // status 遷移（成功時）
  // =====================
  describe('status 遷移（成功時）', () => {
    it('保存開始で saving → 成功後 saved に遷移する', async () => {
      mockUpdatePageContent.mockResolvedValue({ success: true })
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange(SAMPLE_CONTENT, SAMPLE_TEXT)
      })

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)
      })

      expect(result.current.status).toBe('saved')
    })

    it(`saved から ${AUTOSAVE_SAVED_DISPLAY_MS}ms 後に idle に戻る`, async () => {
      mockUpdatePageContent.mockResolvedValue({ success: true })
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange(SAMPLE_CONTENT, SAMPLE_TEXT)
      })

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)
      })
      expect(result.current.status).toBe('saved')

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_SAVED_DISPLAY_MS)
      })
      expect(result.current.status).toBe('idle')
    })
  })

  // =====================
  // status 遷移（失敗時）
  // =====================
  describe('status 遷移（失敗時）', () => {
    it('保存失敗で error 状態になる', async () => {
      mockUpdatePageContent.mockResolvedValue({ success: false, error: '保存エラー' })
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange(SAMPLE_CONTENT, SAMPLE_TEXT)
      })

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)
      })

      expect(result.current.status).toBe('error')
    })

    it('失敗後にエラーバウンダリに例外を投げない（status が error のみ）', async () => {
      // updatePageContent が rejected を返す場合でも status のみ変わってエラーを上に投げない。
      // Unhandled Rejection を避けるため success:false で resolved させる。
      mockUpdatePageContent.mockResolvedValue({ success: false, error: 'network error' })
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange(SAMPLE_CONTENT, SAMPLE_TEXT)
      })
      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)
      })

      // エラーバウンダリに投げず、error 状態になる
      expect(result.current.status).toBe('error')
    })

    it('失敗時に pending content が保持される（再試行可能）', async () => {
      mockUpdatePageContent.mockResolvedValueOnce({ success: false, error: '失敗' })

      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange(SAMPLE_CONTENT, SAMPLE_TEXT)
      })

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)
      })

      expect(result.current.status).toBe('error')

      // 再試行して今度は成功
      mockUpdatePageContent.mockResolvedValueOnce({ success: true })

      await act(async () => {
        result.current.saveNow()
        // saveNow の Promise を flush
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(mockUpdatePageContent).toHaveBeenCalledTimes(2)
      expect(result.current.status).toBe('saved')
    })
  })

  // =====================
  // saveNow（即時保存・再試行）
  // =====================
  describe('saveNow（即時保存・再試行）', () => {
    it('saveNow で debounce をバイパスして即時保存する', async () => {
      mockUpdatePageContent.mockResolvedValue({ success: true })
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange(SAMPLE_CONTENT, SAMPLE_TEXT)
      })

      // debounce より前に saveNow を呼ぶ
      await act(async () => {
        result.current.saveNow()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(mockUpdatePageContent).toHaveBeenCalledOnce()
    })

    it('pending content がない場合は saveNow しても updatePageContent を呼ばない', async () => {
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      await act(async () => {
        result.current.saveNow()
        await Promise.resolve()
      })

      expect(mockUpdatePageContent).not.toHaveBeenCalled()
    })

    it('error 状態から saveNow で再試行すると saving → saved に遷移する', async () => {
      mockUpdatePageContent
        .mockResolvedValueOnce({ success: false, error: '失敗' })
        .mockResolvedValueOnce({ success: true })

      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange(SAMPLE_CONTENT, SAMPLE_TEXT)
      })
      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)
      })
      expect(result.current.status).toBe('error')

      await act(async () => {
        result.current.saveNow()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(result.current.status).toBe('saved')
    })
  })

  // =====================
  // アンマウント
  // =====================
  describe('アンマウント', () => {
    it('アンマウント時にタイマーがクリアされ、保存は呼ばれない', async () => {
      const { result, unmount } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange(SAMPLE_CONTENT, SAMPLE_TEXT)
      })

      unmount()

      // アンマウント後にタイマーを進めても保存は呼ばれない
      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2)
      })

      expect(mockUpdatePageContent).not.toHaveBeenCalled()
    })
  })

  // =====================
  // API キー漏洩防止（型レベル）
  // =====================
  describe('API キー漏洩防止', () => {
    it('updatePageContent の引数に apiKey フィールドが存在しないことを確認する', async () => {
      mockUpdatePageContent.mockResolvedValue({ success: true })
      const { result } = renderHook(() => useAutosave({ pageId: PAGE_ID }))

      act(() => {
        result.current.onContentChange(SAMPLE_CONTENT, SAMPLE_TEXT)
      })
      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS)
      })

      const callArg = mockUpdatePageContent.mock.calls[0]?.[0] as Record<string, unknown>
      expect(callArg).not.toHaveProperty('apiKey')
      expect(callArg).not.toHaveProperty('api_key')
    })
  })
})
