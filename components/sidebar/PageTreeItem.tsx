'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronRight, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageItemMenu } from './PageItemMenu'
import { usePageMutations } from '@/hooks/use-page-mutations'
import { useSidebarState } from '@/hooks/use-sidebar-state'
import { displayTitle } from '@/lib/utils/page-display'
import { ROUTES } from '@/lib/constants/routes'
import type { PageTreeNode } from '@/lib/services/page-tree'
import { cn } from '@/lib/utils'

type PageTreeItemProps = {
  node: PageTreeNode
  depth?: number
  currentPageId?: string
}

export function PageTreeItem({ node, depth = 0, currentPageId }: PageTreeItemProps) {
  const { isExpanded, toggle } = useSidebarState()
  const { rename } = usePageMutations()
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const expanded = isExpanded(node.id)
  const hasChildren = node.children.length > 0
  const isActive = currentPageId === node.id

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isRenaming])

  const handleRenameStart = useCallback(() => {
    setRenameValue(node.title)
    setIsRenaming(true)
  }, [node.title])

  const handleRenameSubmit = useCallback(async () => {
    setIsRenaming(false)
    const trimmed = renameValue.trim()
    if (trimmed !== node.title) {
      await rename({ id: node.id, title: trimmed })
    }
  }, [rename, node.id, node.title, renameValue])

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      setIsRenaming(false)
      setRenameValue(node.title)
    }
  }

  const indentStyle = { paddingLeft: `${depth * 12 + 8}px` }

  return (
    <div>
      <div
        className={cn(
          'group/page-item flex items-center gap-0.5 rounded-md py-0.5 pr-1 text-sm hover:bg-muted/60 transition-colors',
          isActive && 'bg-muted text-foreground font-medium'
        )}
        style={indentStyle}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn('shrink-0 transition-transform', !hasChildren && 'invisible')}
          onClick={() => toggle(node.id)}
          aria-label={expanded ? '折りたたむ' : '展開する'}
        >
          <ChevronRight
            className={cn('size-3.5 transition-transform duration-150', expanded && 'rotate-90')}
          />
        </Button>

        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            className="flex-1 min-w-0 bg-background border border-ring rounded px-1 py-0.5 text-sm outline-none"
          />
        ) : (
          <Link
            href={`${ROUTES.PAGES}/${node.id}`}
            className="flex flex-1 min-w-0 items-center gap-1.5 truncate py-0.5"
          >
            {node.icon ? (
              <span className="shrink-0 text-base leading-none">{node.icon}</span>
            ) : (
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{displayTitle(node.title)}</span>
          </Link>
        )}

        <PageItemMenu pageId={node.id} onRenameStart={handleRenameStart} />
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              currentPageId={currentPageId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
