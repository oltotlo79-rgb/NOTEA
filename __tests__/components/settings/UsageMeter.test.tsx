import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UsageMeter } from '@/components/settings/UsageMeter'

const defaultProps = {
  label: 'ページ数',
  used: 42,
  limit: 100,
  unit: 'ページ',
  formattedUsed: '42',
  formattedLimit: '100',
  planLabel: '無料プラン',
}

describe('UsageMeter', () => {
  it('使用量と上限が表示される', () => {
    render(<UsageMeter {...defaultProps} />)
    expect(screen.getByText(/42 \/ 100 ページ（無料プラン）/)).toBeInTheDocument()
  })

  it('progressbar の ARIA 属性が正しい', () => {
    render(<UsageMeter {...defaultProps} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '42')
    expect(progressbar).toHaveAttribute('aria-valuemin', '0')
    expect(progressbar).toHaveAttribute('aria-valuemax', '100')
  })

  it('aria-label に label・使用量・単位が含まれる', () => {
    render(<UsageMeter {...defaultProps} />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-label', 'ページ数: 42 / 100 ページ')
  })

  it('使用率が 80% 未満の場合は警告色にならない', () => {
    render(<UsageMeter {...defaultProps} used={42} limit={100} />)
    const bar = screen.getByRole('progressbar').querySelector('div')
    expect(bar?.className).not.toContain('bg-destructive')
    expect(bar?.className).toContain('bg-primary')
  })

  it('使用率が 80% 以上の場合は警告色（bg-destructive）になる', () => {
    render(
      <UsageMeter
        {...defaultProps}
        used={80}
        limit={100}
        formattedUsed="80"
      />
    )
    const bar = screen.getByRole('progressbar').querySelector('div')
    expect(bar?.className).toContain('bg-destructive')
  })

  it('使用率 100% の場合も警告色になる', () => {
    render(
      <UsageMeter
        {...defaultProps}
        used={100}
        limit={100}
        formattedUsed="100"
      />
    )
    const bar = screen.getByRole('progressbar').querySelector('div')
    expect(bar?.className).toContain('bg-destructive')
  })

  it('使用量 0 のときはバー幅 0%', () => {
    render(
      <UsageMeter
        {...defaultProps}
        used={0}
        formattedUsed="0"
      />
    )
    const bar = screen.getByRole('progressbar').querySelector('div')
    expect(bar).toHaveStyle({ width: '0%' })
  })

  it('testId が指定された場合は data-testid が付与される', () => {
    render(<UsageMeter {...defaultProps} testId="usage-pages-meter" />)
    expect(screen.getByTestId('usage-pages-meter')).toBeInTheDocument()
  })

  it('パーセンテージが表示される', () => {
    render(<UsageMeter {...defaultProps} used={42} limit={100} />)
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('limit が 0 のときは 0% として扱われる', () => {
    render(
      <UsageMeter
        {...defaultProps}
        used={0}
        limit={0}
        formattedUsed="0"
        formattedLimit="0"
      />
    )
    const bar = screen.getByRole('progressbar').querySelector('div')
    expect(bar).toHaveStyle({ width: '0%' })
  })
})
