/**
 * @module __tests__/components/editor/EditorSkeleton.test.tsx
 * EditorSkeleton コンポーネントのユニットテスト。
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorSkeleton } from '@/components/editor/EditorSkeleton'

describe('EditorSkeleton', () => {
  it('aria-label="エディタ読み込み中" の要素が存在する', () => {
    render(<EditorSkeleton />)
    expect(screen.getByLabelText('エディタ読み込み中')).toBeInTheDocument()
  })

  it('複数のスケルトン行を描画する', () => {
    render(<EditorSkeleton />)
    const container = screen.getByLabelText('エディタ読み込み中')
    // スケルトン要素が最低 1 件以上存在する（デザイン上 6 行）
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it('スケルトン行が 6 本描画される', () => {
    render(<EditorSkeleton />)
    const container = screen.getByLabelText('エディタ読み込み中')
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBe(6)
  })

  it('各スケルトンが animate-pulse クラスを持つ', () => {
    render(<EditorSkeleton />)
    const container = screen.getByLabelText('エディタ読み込み中')
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
    skeletons.forEach((el) => {
      expect(el.className).toContain('animate-pulse')
    })
  })
})
