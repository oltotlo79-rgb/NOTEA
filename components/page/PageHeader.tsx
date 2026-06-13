'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updatePageMeta } from '@/lib/actions/pages'
import { displayTitle } from '@/lib/utils/page-display'

type PageHeaderProps = {
  pageId: string
  title: string
  icon: string | null
}

export function PageHeader({ pageId, title: initialTitle, icon: initialIcon }: PageHeaderProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(initialTitle)
  const [icon, setIcon] = useState(initialIcon)
  const [isEditingIcon, setIsEditingIcon] = useState(false)
  const [iconInput, setIconInput] = useState(initialIcon ?? '')

  const handleTitleBlur = useCallback(async () => {
    if (title !== initialTitle) {
      const result = await updatePageMeta({ id: pageId, title })
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['page-tree'] })
      }
    }
  }, [title, initialTitle, pageId, queryClient])

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  const handleIconBlur = useCallback(async () => {
    setIsEditingIcon(false)
    const trimmed = iconInput.trim() || null
    if (trimmed !== initialIcon) {
      const result = await updatePageMeta({ id: pageId, icon: trimmed })
      if (result.success) {
        setIcon(trimmed)
        queryClient.invalidateQueries({ queryKey: ['page-tree'] })
      }
    }
  }, [iconInput, initialIcon, pageId, queryClient])

  const handleIconKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setIsEditingIcon(false)
      setIconInput(icon ?? '')
    }
  }

  return (
    <div className="px-8 pt-12 pb-4">
      {/* アイコン */}
      <div className="mb-3">
        {isEditingIcon ? (
          <input
            value={iconInput}
            onChange={(e) => setIconInput(e.target.value)}
            onBlur={handleIconBlur}
            onKeyDown={handleIconKeyDown}
            autoFocus
            placeholder="絵文字を入力"
            className="text-4xl w-16 bg-transparent border-b border-border outline-none text-center"
          />
        ) : (
          <button
            onClick={() => {
              setIconInput(icon ?? '')
              setIsEditingIcon(true)
            }}
            className="text-4xl leading-none hover:bg-muted rounded-md px-1 py-0.5 transition-colors"
            aria-label="アイコンを変更"
          >
            {icon ?? '📄'}
          </button>
        )}
      </div>

      {/* タイトル */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        placeholder={displayTitle(undefined)}
        className="w-full text-3xl font-bold bg-transparent outline-none placeholder:text-muted-foreground/50 border-none"
      />
    </div>
  )
}
