'use client'

/**
 * @module hooks/use-image-url
 * Supabase Storage の非公開パスから署名付き閲覧URLを解決するフック。
 * path を content に保存し、表示時にのみ署名URLを生成することで
 * 期限切れ問題を回避する。
 */
import { useReducer, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// 署名URLの有効期限（秒）。1時間
const SIGNED_URL_EXPIRES_IN = 3600

// Supabase Storage パスかどうかを判定する（http/blob/dataから始まるURLは通過させる）
export function isStoragePath(src: string): boolean {
  return src.length > 0 && !src.startsWith('http') && !src.startsWith('blob:') && !src.startsWith('data:')
}

type State = {
  url: string | null
  error: boolean
}

type Action =
  | { type: 'resolve'; url: string }
  | { type: 'error' }

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case 'resolve':
      return { url: action.url, error: false }
    case 'error':
      return { url: null, error: true }
  }
}

function initializer(src: string): State {
  if (isStoragePath(src)) {
    return { url: null, error: false }
  }
  return { url: src, error: false }
}

export function useImageUrl(src: string): State {
  const [state, dispatch] = useReducer(reducer, src, initializer)

  useEffect(() => {
    if (!isStoragePath(src)) {
      // 非 Storage URL はコールバック経由で dispatch（lint ルール: エフェクト内の同期 setState 禁止）
      void Promise.resolve(src).then((resolvedUrl) => dispatch({ type: 'resolve', url: resolvedUrl }))
      return
    }

    let cancelled = false
    const supabase = createClient()

    supabase.storage
      .from('page-images')
      .createSignedUrl(src, SIGNED_URL_EXPIRES_IN)
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e || !data?.signedUrl) {
          dispatch({ type: 'error' })
        } else {
          dispatch({ type: 'resolve', url: data.signedUrl })
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [src])

  return state
}
