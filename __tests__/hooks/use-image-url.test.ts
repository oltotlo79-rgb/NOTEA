/**
 * @module __tests__/hooks/use-image-url.test.ts
 * useImageUrl フックのユニットテスト。
 * Supabase client の createSignedUrl をモックして署名URL解決を検証する。
 */
import { renderHook, act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateSignedUrl = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}))

const { useImageUrl, isStoragePath } = await import('@/hooks/use-image-url')

beforeEach(() => {
  vi.clearAllMocks()
})

// =====================
// isStoragePath ユーティリティ
// =====================
describe('isStoragePath', () => {
  it('Storage パス（相対パス形式）は true を返す', () => {
    expect(isStoragePath('user-id/page-id/image.webp')).toBe(true)
  })

  it('http で始まる URL は false を返す', () => {
    expect(isStoragePath('https://example.com/image.webp')).toBe(false)
  })

  it('http: で始まる URL は false を返す', () => {
    expect(isStoragePath('http://example.com/image.webp')).toBe(false)
  })

  it('blob: URL は false を返す', () => {
    expect(isStoragePath('blob:https://example.com/1234')).toBe(false)
  })

  it('data: URL は false を返す', () => {
    expect(isStoragePath('data:image/webp;base64,abc')).toBe(false)
  })

  it('空文字は false を返す', () => {
    expect(isStoragePath('')).toBe(false)
  })
})

// =====================
// useImageUrl フック
// =====================
describe('useImageUrl', () => {
  // =====================
  // Storage パス → 署名URL
  // =====================
  describe('Storage パス → 署名URL 解決', () => {
    it('Storage パスが渡されると createSignedUrl を呼び署名URLを返す', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://supabase.example.com/signed/image.webp' },
        error: null,
      })

      const { result } = renderHook(() => useImageUrl('user-1/page-1/image.webp'))

      await waitFor(() => expect(result.current.url).toBeTruthy())
      expect(result.current.url).toBe('https://supabase.example.com/signed/image.webp')
      expect(result.current.error).toBe(false)
    })

    it('page-images バケットから createSignedUrl を呼ぶ', async () => {
      const mockFrom = vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl }))
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://signed.example.com/img.webp' },
        error: null,
      })

      vi.doMock('@/lib/supabase/client', () => ({
        createClient: () => ({ storage: { from: mockFrom } }),
      }))

      const { useImageUrl: useImageUrlFresh } = await import('@/hooks/use-image-url')
      renderHook(() => useImageUrlFresh('user-1/page-1/test.webp'))

      await waitFor(() => expect(mockCreateSignedUrl).toHaveBeenCalled())
    })

    it('createSignedUrl が有効期限 3600 秒で呼ばれる', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://signed.example.com/img.webp' },
        error: null,
      })

      renderHook(() => useImageUrl('user-1/page-1/image.webp'))

      await waitFor(() => expect(mockCreateSignedUrl).toHaveBeenCalled())
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('user-1/page-1/image.webp', 3600)
    })

    it('初期状態は url=null, error=false', () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://example.com/img.webp' },
        error: null,
      })
      const { result } = renderHook(() => useImageUrl('user-1/page-1/image.webp'))
      // マウント直後（非同期解決前）
      expect(result.current.url).toBeNull()
      expect(result.current.error).toBe(false)
    })
  })

  // =====================
  // 外部 URL パススルー
  // =====================
  describe('外部 URL パススルー', () => {
    it('http:// URL は createSignedUrl を呼ばずそのまま返す', async () => {
      const { result } = renderHook(() => useImageUrl('https://cdn.example.com/image.webp'))

      await waitFor(() => expect(result.current.url).toBeTruthy())
      expect(result.current.url).toBe('https://cdn.example.com/image.webp')
      expect(mockCreateSignedUrl).not.toHaveBeenCalled()
    })

    it('blob: URL はそのまま返す', async () => {
      const blobUrl = 'blob:https://example.com/1234-5678'
      const { result } = renderHook(() => useImageUrl(blobUrl))

      await waitFor(() => expect(result.current.url).toBeTruthy())
      expect(result.current.url).toBe(blobUrl)
    })

    it('data: URL はそのまま返す', async () => {
      const dataUrl = 'data:image/webp;base64,abc123'
      const { result } = renderHook(() => useImageUrl(dataUrl))

      await waitFor(() => expect(result.current.url).toBeTruthy())
      expect(result.current.url).toBe(dataUrl)
    })
  })

  // =====================
  // エラー時
  // =====================
  describe('エラー時の扱い', () => {
    it('createSignedUrl がエラーを返したら error=true になる', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'storage error' },
      })

      const { result } = renderHook(() => useImageUrl('user-1/page-1/image.webp'))

      await waitFor(() => expect(result.current.error).toBe(true))
      expect(result.current.url).toBeNull()
    })

    it('createSignedUrl が signedUrl=null を返したら error=true になる', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: null },
        error: null,
      })

      const { result } = renderHook(() => useImageUrl('user-1/page-1/image.webp'))

      await waitFor(() => expect(result.current.error).toBe(true))
    })

    it('createSignedUrl が例外を投げたら error=true になる', async () => {
      mockCreateSignedUrl.mockRejectedValueOnce(new Error('network error'))

      const { result } = renderHook(() => useImageUrl('user-1/page-1/image.webp'))

      await waitFor(() => expect(result.current.error).toBe(true))
      expect(result.current.url).toBeNull()
    })
  })

  // =====================
  // アンマウント時のキャンセル
  // =====================
  describe('アンマウント時のキャンセル', () => {
    it('アンマウント後に createSignedUrl が解決しても state を更新しない', async () => {
      let resolveSignedUrl: (value: { data: { signedUrl: string }; error: null }) => void

      mockCreateSignedUrl.mockReturnValueOnce(
        new Promise<{ data: { signedUrl: string }; error: null }>((resolve) => {
          resolveSignedUrl = resolve
        })
      )

      const { result, unmount } = renderHook(() => useImageUrl('user-1/page-1/image.webp'))
      unmount()

      await act(async () => {
        resolveSignedUrl({ data: { signedUrl: 'https://example.com/late.webp' }, error: null })
        await Promise.resolve()
      })

      // アンマウント済みのため state は初期値のまま
      expect(result.current.url).toBeNull()
      expect(result.current.error).toBe(false)
    })
  })
})
