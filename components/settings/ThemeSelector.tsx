'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

type ThemeOption = {
  value: string
  label: string
  icon: React.ReactNode
  testId: string
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'ライト',
    icon: <Sun className="size-6" aria-hidden="true" />,
    testId: 'theme-light',
  },
  {
    value: 'dark',
    label: 'ダーク',
    icon: <Moon className="size-6" aria-hidden="true" />,
    testId: 'theme-dark',
  },
  {
    value: 'system',
    label: 'システム',
    icon: <Monitor className="size-6" aria-hidden="true" />,
    testId: 'theme-system',
  },
]

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const groupId = useId()

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % THEME_OPTIONS.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length
    } else {
      return
    }
    e.preventDefault()
    const nextOption = THEME_OPTIONS[nextIndex]
    if (nextOption) {
      setTheme(nextOption.value)
      const nextButton = document.getElementById(`${groupId}-${nextOption.value}`)
      nextButton?.focus()
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="テーマを選択"
      className="flex gap-3 flex-wrap"
    >
      {THEME_OPTIONS.map((option, index) => {
        const isSelected = theme === option.value
        return (
          <button
            key={option.value}
            id={`${groupId}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            data-testid={option.testId}
            onClick={() => setTheme(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'border border-border rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-muted cursor-pointer w-28 transition-all focus-visible:ring-2 focus-visible:ring-ring outline-none',
              isSelected && 'ring-2 ring-primary'
            )}
          >
            {option.icon}
            <span className="text-sm">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
