import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HighlightedText } from '@/components/search/HighlightedText'

describe('HighlightedText', () => {
  it('一致部分を <mark> で強調する', () => {
    const { container } = render(<HighlightedText text="Next.js は React" query="React" />)
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toBe('React')
  })

  it('大小文字を無視して一致させ、元の表記を保持する', () => {
    const { container } = render(<HighlightedText text="TypeScript" query="typescript" />)
    const mark = container.querySelector('mark')
    expect(mark?.textContent).toBe('TypeScript')
  })

  it('複数箇所を強調する', () => {
    const { container } = render(<HighlightedText text="abab" query="ab" />)
    expect(container.querySelectorAll('mark')).toHaveLength(2)
  })

  it('query が空のときはテキストをそのまま表示する', () => {
    const { container } = render(<HighlightedText text="hello world" query="" />)
    expect(container.querySelector('mark')).toBeNull()
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('一致がないときは <mark> を生成しない', () => {
    const { container } = render(<HighlightedText text="hello" query="zzz" />)
    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toBe('hello')
  })

  it('HTML を含む query でもエスケープされ DOM 注入されない', () => {
    const { container } = render(
      <HighlightedText text="<script>alert(1)</script>" query="<script>" />
    )
    // <script> 要素として解釈されず、テキストとして表示される
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toBe('<script>alert(1)</script>')
  })
})
