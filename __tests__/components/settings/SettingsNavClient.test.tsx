import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// usePathname をモック
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

import { usePathname } from 'next/navigation'
import { SettingsNavClient } from '@/components/settings/SettingsNavClient'

describe('SettingsNavClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('nav 要素が aria-label="設定メニュー" で描画される', () => {
    render(<SettingsNavClient />)
    const nav = screen.getByRole('navigation', { name: '設定メニュー' })
    expect(nav).toBeInTheDocument()
  })

  it('data-testid="settings-nav" が付与される', () => {
    render(<SettingsNavClient />)
    expect(screen.getByTestId('settings-nav')).toBeInTheDocument()
  })

  it('プロフィールリンクが存在する', () => {
    render(<SettingsNavClient />)
    expect(screen.getByTestId('settings-nav-profile')).toBeInTheDocument()
  })

  it('使用量リンクが存在する', () => {
    render(<SettingsNavClient />)
    expect(screen.getByTestId('settings-nav-usage')).toBeInTheDocument()
  })

  it('外観リンクが存在する', () => {
    render(<SettingsNavClient />)
    expect(screen.getByTestId('settings-nav-appearance')).toBeInTheDocument()
  })

  it('AI キー管理リンクが存在する', () => {
    render(<SettingsNavClient />)
    expect(screen.getByTestId('settings-nav-ai')).toBeInTheDocument()
  })

  it('アカウントリンクが存在する', () => {
    render(<SettingsNavClient />)
    expect(screen.getByTestId('settings-nav-account')).toBeInTheDocument()
  })

  it('現在のパスと一致するリンクに aria-current="page" が付与される', () => {
    vi.mocked(usePathname).mockReturnValue('/settings/profile')
    render(<SettingsNavClient />)
    const activeLink = screen.getByTestId('settings-nav-profile')
    expect(activeLink).toHaveAttribute('aria-current', 'page')
  })

  it('現在のパスと一致しないリンクには aria-current が付与されない', () => {
    vi.mocked(usePathname).mockReturnValue('/settings/profile')
    render(<SettingsNavClient />)
    const usageLink = screen.getByTestId('settings-nav-usage')
    expect(usageLink).not.toHaveAttribute('aria-current')
  })

  it('使用量ページがアクティブな場合はそのリンクに aria-current が付与される', () => {
    vi.mocked(usePathname).mockReturnValue('/settings/usage')
    render(<SettingsNavClient />)
    const activeLink = screen.getByTestId('settings-nav-usage')
    expect(activeLink).toHaveAttribute('aria-current', 'page')
    // 他のリンクには付与されない
    expect(screen.getByTestId('settings-nav-profile')).not.toHaveAttribute('aria-current')
  })
})
