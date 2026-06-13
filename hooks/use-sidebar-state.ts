'use client'

import { useState, useCallback } from 'react'

const SIDEBAR_EXPANDED_KEY = 'notea_sidebar_expanded'
const SIDEBAR_COLLAPSED_KEY = 'notea_sidebar_collapsed'

function readExpandedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY)
    if (!stored) return new Set()
    const parsed: unknown = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === 'string'))
    }
  } catch {
    // localStorage が使えない環境では空セットを返す
  }
  return new Set()
}

function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

type SidebarState = {
  isExpanded: (id: string) => boolean
  toggle: (id: string) => void
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
}

export function useSidebarState(): SidebarState {
  // 初期化関数を渡すことで SSR 時は空、ブラウザでは localStorage から復元する
  const [expandedIds, setExpandedIds] = useState<Set<string>>(readExpandedIds)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(readSidebarCollapsed)

  const isExpanded = useCallback(
    (id: string) => expandedIds.has(id),
    [expandedIds]
  )

  const toggle = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        try {
          localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify([...next]))
        } catch {
          // localStorage 書き込み失敗は無視する
        }
        return next
      })
    },
    []
  )

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        // localStorage 書き込み失敗は無視する
      }
      return next
    })
  }, [])

  return { isExpanded, toggle, isSidebarCollapsed, toggleSidebar }
}
