import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QueryProvider } from '@/components/providers/QueryProvider'

describe('QueryProvider', () => {
  it('children を描画する', () => {
    render(
      <QueryProvider>
        <span data-testid="child">コンテンツ</span>
      </QueryProvider>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('コンテンツ')).toBeInTheDocument()
  })

  it('複数の children を描画する', () => {
    render(
      <QueryProvider>
        <span data-testid="child-1">A</span>
        <span data-testid="child-2">B</span>
      </QueryProvider>
    )
    expect(screen.getByTestId('child-1')).toBeInTheDocument()
    expect(screen.getByTestId('child-2')).toBeInTheDocument()
  })
})
