import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/settings/profile'),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { SettingsLayout } from '@/components/settings/SettingsLayout'

describe('SettingsLayout', () => {
  it('children が描画される', () => {
    render(
      <SettingsLayout>
        <div data-testid="content">コンテンツ</div>
      </SettingsLayout>
    )
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('設定ナビが含まれる', () => {
    render(
      <SettingsLayout>
        <div>コンテンツ</div>
      </SettingsLayout>
    )
    expect(screen.getByTestId('settings-nav')).toBeInTheDocument()
  })

  it('SettingsNavClient のナビ項目が描画される', () => {
    render(
      <SettingsLayout>
        <div>コンテンツ</div>
      </SettingsLayout>
    )
    expect(screen.getByTestId('settings-nav-profile')).toBeInTheDocument()
    expect(screen.getByTestId('settings-nav-usage')).toBeInTheDocument()
  })
})
