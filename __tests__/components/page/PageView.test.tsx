import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/actions/pages', () => ({
  updatePageMeta: vi.fn().mockResolvedValue({ success: true }),
}))

const { PageView } = await import('@/components/page/PageView')

const PAGE_DETAIL = {
  id: 'a0000001-0000-4000-8000-000000000001',
  parent_id: null,
  title: 'テストページ',
  icon: '📝',
  content: null,
  content_text: '',
  updated_at: '2026-01-01T00:00:00Z',
  is_trashed: false,
}

function renderWithQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(createElement(QueryClientProvider, { client: queryClient }, ui))
}

describe('PageView', () => {
  it('ページタイトルを描画する', () => {
    renderWithQuery(<PageView page={PAGE_DETAIL} />)
    expect(screen.getByDisplayValue('テストページ')).toBeInTheDocument()
  })

  it('エディタのプレースホルダーテキストを表示する', () => {
    renderWithQuery(<PageView page={PAGE_DETAIL} />)
    expect(screen.getByText('エディタは次のアップデートで利用可能になります')).toBeInTheDocument()
  })
})
