'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { updatePageContent } from '@/lib/actions/pages'
import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_SAVED_DISPLAY_MS } from '@/lib/constants/limits'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type UseAutosaveOptions = {
  pageId: string
}

type UseAutosaveReturn = {
  status: AutosaveStatus
  /** debounce をバイパスして即時保存する（エラー時の再試行ボタンから呼ぶ） */
  saveNow: () => void
  /** エディタが content を変更するたびに呼ぶ */
  onContentChange: (content: unknown[], contentText: string) => void
}

export function useAutosave({ pageId }: UseAutosaveOptions): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('idle')

  // 最新の content をクロージャ更新なしで参照するために ref を使う
  const pendingContentRef = useRef<{ content: unknown[]; contentText: string } | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current !== null) {
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = null
    }
  }, [])

  const performSave = useCallback(async () => {
    const pending = pendingContentRef.current
    if (!pending || isSavingRef.current) return

    isSavingRef.current = true
    pendingContentRef.current = null
    setStatus('saving')
    clearSavedTimer()

    const result = await updatePageContent({
      id: pageId,
      content: pending.content,
      contentText: pending.contentText,
    })

    isSavingRef.current = false

    if (result.success) {
      setStatus('saved')
      // 3秒後に idle へ
      savedTimerRef.current = setTimeout(() => {
        setStatus('idle')
        savedTimerRef.current = null
      }, AUTOSAVE_SAVED_DISPLAY_MS)
    } else {
      setStatus('error')
      // 保存失敗した content を再度 pending に戻す（再試行できるよう）
      pendingContentRef.current = pending
    }
  }, [pageId, clearSavedTimer])

  const onContentChange = useCallback(
    (content: unknown[], contentText: string) => {
      pendingContentRef.current = { content, contentText }

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        void performSave()
      }, AUTOSAVE_DEBOUNCE_MS)
    },
    [performSave]
  )

  const saveNow = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    void performSave()
  }, [performSave])

  // アンマウント時にタイマーをクリアする
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current)
      clearSavedTimer()
    }
  }, [clearSavedTimer])

  return { status, saveNow, onContentChange }
}
