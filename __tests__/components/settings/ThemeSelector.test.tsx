import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSetTheme = vi.fn()
const mockUseTheme = vi.fn(() => ({ theme: 'system', setTheme: mockSetTheme }))

vi.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}))

import { ThemeSelector } from '@/components/settings/ThemeSelector'

describe('ThemeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTheme.mockReturnValue({ theme: 'system', setTheme: mockSetTheme })
  })

  it('3つのテーマボタンが表示される', () => {
    render(<ThemeSelector />)
    expect(screen.getByTestId('theme-light')).toBeInTheDocument()
    expect(screen.getByTestId('theme-dark')).toBeInTheDocument()
    expect(screen.getByTestId('theme-system')).toBeInTheDocument()
  })

  it('radiogroup の aria-label が正しい', () => {
    render(<ThemeSelector />)
    expect(screen.getByRole('radiogroup', { name: 'テーマを選択' })).toBeInTheDocument()
  })

  it('各ボタンが role="radio" を持つ', () => {
    render(<ThemeSelector />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
  })

  it('ライトボタンに「ライト」テキストが含まれる', () => {
    render(<ThemeSelector />)
    expect(screen.getByTestId('theme-light')).toHaveTextContent('ライト')
  })

  it('ダークボタンに「ダーク」テキストが含まれる', () => {
    render(<ThemeSelector />)
    expect(screen.getByTestId('theme-dark')).toHaveTextContent('ダーク')
  })

  it('システムボタンに「システム」テキストが含まれる', () => {
    render(<ThemeSelector />)
    expect(screen.getByTestId('theme-system')).toHaveTextContent('システム')
  })

  it('現在のテーマ(system)が aria-checked="true"', () => {
    mockUseTheme.mockReturnValue({ theme: 'system', setTheme: mockSetTheme })
    render(<ThemeSelector />)
    const systemBtn = screen.getByTestId('theme-system')
    expect(systemBtn).toHaveAttribute('aria-checked', 'true')
  })

  it('選択されていないテーマは aria-checked="false"', () => {
    mockUseTheme.mockReturnValue({ theme: 'system', setTheme: mockSetTheme })
    render(<ThemeSelector />)
    expect(screen.getByTestId('theme-light')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'false')
  })

  it('ライトボタンをクリックすると setTheme("light") が呼ばれる', () => {
    render(<ThemeSelector />)
    fireEvent.click(screen.getByTestId('theme-light'))
    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })

  it('ダークボタンをクリックすると setTheme("dark") が呼ばれる', () => {
    render(<ThemeSelector />)
    fireEvent.click(screen.getByTestId('theme-dark'))
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('システムボタンをクリックすると setTheme("system") が呼ばれる', () => {
    render(<ThemeSelector />)
    fireEvent.click(screen.getByTestId('theme-system'))
    expect(mockSetTheme).toHaveBeenCalledWith('system')
  })

  it('現在テーマが light のとき light ボタンが aria-checked="true"', () => {
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: mockSetTheme })
    render(<ThemeSelector />)
    expect(screen.getByTestId('theme-light')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('theme-system')).toHaveAttribute('aria-checked', 'false')
  })

  it('ArrowRight キーで次のテーマに移動する', () => {
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: mockSetTheme })
    render(<ThemeSelector />)
    const lightBtn = screen.getByTestId('theme-light')
    fireEvent.keyDown(lightBtn, { key: 'ArrowRight' })
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('ArrowLeft キーで前のテーマに移動する', () => {
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: mockSetTheme })
    render(<ThemeSelector />)
    const lightBtn = screen.getByTestId('theme-light')
    fireEvent.keyDown(lightBtn, { key: 'ArrowLeft' })
    // light は 0番目、ArrowLeft で最後（system: index 2）に移動
    expect(mockSetTheme).toHaveBeenCalledWith('system')
  })

  it('ArrowDown キーで次のテーマに移動する', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme: mockSetTheme })
    render(<ThemeSelector />)
    const darkBtn = screen.getByTestId('theme-dark')
    fireEvent.keyDown(darkBtn, { key: 'ArrowDown' })
    expect(mockSetTheme).toHaveBeenCalledWith('system')
  })

  it('ArrowUp キーで前のテーマに移動する', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme: mockSetTheme })
    render(<ThemeSelector />)
    const darkBtn = screen.getByTestId('theme-dark')
    fireEvent.keyDown(darkBtn, { key: 'ArrowUp' })
    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })

  it('選択されているボタンの tabIndex は 0', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme: mockSetTheme })
    render(<ThemeSelector />)
    expect(screen.getByTestId('theme-dark')).toHaveAttribute('tabIndex', '0')
    expect(screen.getByTestId('theme-light')).toHaveAttribute('tabIndex', '-1')
    expect(screen.getByTestId('theme-system')).toHaveAttribute('tabIndex', '-1')
  })
})
