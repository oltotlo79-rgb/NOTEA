'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, BarChart2, Sun, Sparkles, Trash2, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants/routes'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  testId: string
}

const NAV_ITEMS: NavItem[] = [
  {
    href: ROUTES.SETTINGS_PROFILE,
    label: 'プロフィール',
    icon: <User className="size-4" aria-hidden="true" />,
    testId: 'settings-nav-profile',
  },
  {
    href: ROUTES.SETTINGS_USAGE,
    label: '使用量',
    icon: <BarChart2 className="size-4" aria-hidden="true" />,
    testId: 'settings-nav-usage',
  },
  {
    href: ROUTES.SETTINGS_PLAN,
    label: 'プラン',
    icon: <CreditCard className="size-4" aria-hidden="true" />,
    testId: 'settings-nav-plan',
  },
  {
    href: ROUTES.SETTINGS_APPEARANCE,
    label: '外観',
    icon: <Sun className="size-4" aria-hidden="true" />,
    testId: 'settings-nav-appearance',
  },
  {
    href: ROUTES.SETTINGS_AI,
    label: 'AI キー管理',
    icon: <Sparkles className="size-4" aria-hidden="true" />,
    testId: 'settings-nav-ai',
  },
  {
    href: ROUTES.SETTINGS_ACCOUNT,
    label: 'アカウント',
    icon: <Trash2 className="size-4" aria-hidden="true" />,
    testId: 'settings-nav-account',
  },
]

export function SettingsNavClient() {
  const pathname = usePathname()

  return (
    <nav aria-label="設定メニュー" data-testid="settings-nav">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-testid={item.testId}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
