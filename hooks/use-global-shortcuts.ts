'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'
import { usePageMutations } from '@/hooks/use-page-mutations'

/**
 * アプリ全体で有効なキーボードショートカットを登録する。
 * 入力要素（input/textarea/[contenteditable]）にフォーカスがある場合は発動しない。
 * BlockNote エディタの contenteditable にフォーカス中も発動しないため
 * エディタの標準ショートカットとの衝突がない。
 */
export function useGlobalShortcuts(options: {
  onToggleSidebar: () => void
}) {
  const router = useRouter()
  const { create } = usePageMutations()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey

      if (!isCtrlOrCmd) return

      // 入力要素にフォーカス中はショートカットを無効化
      const target = e.target
      if (target instanceof HTMLElement) {
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }
      }

      if (e.key === 'n') {
        e.preventDefault()
        void create({}).then((result) => {
          if (result.success && result.data) {
            router.push(`${ROUTES.PAGES}/${result.data.id}`)
          }
        })
      }

      if (e.key === ',') {
        e.preventDefault()
        router.push(ROUTES.SETTINGS)
      }

      if (e.key === '\\') {
        e.preventDefault()
        options.onToggleSidebar()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router, create, options])
}
