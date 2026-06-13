'use client'

import type { SuggestionMenuProps } from '@blocknote/react'
import type { DefaultReactSuggestionItem } from '@blocknote/react'

type SlashMenuProps = SuggestionMenuProps<DefaultReactSuggestionItem>

export function SlashMenu({ items, loadingState, selectedIndex, onItemClick }: SlashMenuProps) {
  if (loadingState === 'loading-initial') {
    return null
  }

  if (items.length === 0) {
    return (
      <div
        data-testid="slash-command-menu"
        className="w-72 rounded-md border border-border bg-popover shadow-lg"
      >
        <div className="px-2 py-3 text-sm text-muted-foreground">
          一致するコマンドはありません
        </div>
      </div>
    )
  }

  // グループでまとめる
  const groups: { [group: string]: DefaultReactSuggestionItem[] } = {}
  for (const item of items) {
    const group = item.group ?? 'その他'
    if (!groups[group]) groups[group] = []
    groups[group].push(item)
  }

  let globalIndex = 0

  return (
    <div
      data-testid="slash-command-menu"
      role="listbox"
      aria-label="コマンドを選択"
      className="w-72 max-h-80 overflow-y-auto rounded-md border border-border bg-popover shadow-lg py-1"
    >
      {Object.entries(groups).map(([group, groupItems]) => (
        <div key={group}>
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
            {group}
          </div>
          {groupItems.map((item) => {
            const currentIndex = globalIndex++
            const isSelected = selectedIndex === currentIndex
            return (
              <button
                key={item.title}
                role="option"
                aria-selected={isSelected}
                onClick={() => onItemClick?.(item)}
                className={`flex w-full gap-3 px-2 py-2 text-left rounded-sm cursor-pointer transition-colors ${
                  isSelected ? 'bg-muted' : 'hover:bg-muted'
                }`}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-sm">
                  {item.icon}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{item.title}</span>
                  {item.subtext && (
                    <span className="text-xs text-muted-foreground truncate">{item.subtext}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
