import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseSearch = vi.fn()
vi.mock('@/hooks/use-search', () => ({
  useSearch: () => mockUseSearch(),
}))

const { SearchView } = await import('@/components/search/SearchView')

const RESULT_1 = {
  id: 'a0000001-0000-4000-8000-000000000001',
  title: 'Next.js の使い方',
  icon: null,
  updatedAt: '2026-06-17T00:00:00.000Z',
  snippet: 'Next.js は React フレームワークです',
}
const RESULT_2 = {
  id: 'a0000002-0000-4000-8000-000000000002',
  title: 'TypeScript 入門',
  icon: '📘',
  updatedAt: '2026-06-16T00:00:00.000Z',
  snippet: '型付き JavaScript',
}

function makeState(overrides: Partial<ReturnType<typeof mockUseSearch>> = {}) {
  return {
    query: '',
    setQuery: vi.fn(),
    debouncedQuery: '',
    results: [],
    isLoading: false,
    isFetching: false,
    error: null,
    loadMore: vi.fn(),
    hasMore: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SearchView', () => {
  it('クエリ未入力のときは案内文を表示する', () => {
    mockUseSearch.mockReturnValue(makeState())
    render(<SearchView />)
    expect(screen.getByText('キーワードを入力してページを検索します')).toBeInTheDocument()
  })

  it('入力すると setQuery が呼ばれる', async () => {
    const setQuery = vi.fn()
    mockUseSearch.mockReturnValue(makeState({ setQuery }))
    const user = userEvent.setup()

    render(<SearchView />)
    await user.type(screen.getByLabelText('ページを検索'), 'a')

    expect(setQuery).toHaveBeenCalledWith('a')
  })

  it('検索結果を描画する（タイトル・スニペット・アイコン）', () => {
    mockUseSearch.mockReturnValue(
      makeState({ debouncedQuery: 'Next', results: [RESULT_1, RESULT_2] })
    )
    render(<SearchView />)

    expect(screen.getByText('TypeScript 入門')).toBeInTheDocument()
    expect(screen.getByText('📘')).toBeInTheDocument()
    expect(screen.getByText('型付き JavaScript')).toBeInTheDocument()
    // タイトル一致部分は <mark> で強調される（テキストが分割されても全体は読める）
    expect(screen.getByRole('link', { name: /Next\.js の使い方/ })).toBeInTheDocument()
  })

  it('結果リンクは /pages/[id] を指す', () => {
    mockUseSearch.mockReturnValue(makeState({ debouncedQuery: 'Next', results: [RESULT_1] }))
    render(<SearchView />)

    const link = screen.getByRole('link', { name: /Next\.js の使い方/ })
    expect(link).toHaveAttribute('href', `/pages/${RESULT_1.id}`)
  })

  it('0 件のときは該当なしメッセージを表示する', () => {
    mockUseSearch.mockReturnValue(makeState({ debouncedQuery: 'zzz', results: [] }))
    render(<SearchView />)
    expect(screen.getByText(/「zzz」に一致するページはありませんでした/)).toBeInTheDocument()
  })

  it('ロード中は skeleton を表示する（結果ゼロ件時）', () => {
    mockUseSearch.mockReturnValue(
      makeState({ debouncedQuery: 'Next', results: [], isLoading: true })
    )
    render(<SearchView />)
    expect(screen.queryByText(/一致するページはありませんでした/)).not.toBeInTheDocument()
    expect(screen.queryByText('検索に失敗しました')).not.toBeInTheDocument()
  })

  it('エラー時はエラーメッセージを表示する', () => {
    mockUseSearch.mockReturnValue(
      makeState({ debouncedQuery: 'Next', error: new Error('boom') })
    )
    render(<SearchView />)
    expect(screen.getByText('検索に失敗しました')).toBeInTheDocument()
  })

  it('hasMore=true のとき「もっと見る」を表示しクリックで loadMore を呼ぶ', async () => {
    const loadMore = vi.fn()
    mockUseSearch.mockReturnValue(
      makeState({ debouncedQuery: 'Next', results: [RESULT_1], hasMore: true, loadMore })
    )
    const user = userEvent.setup()

    render(<SearchView />)
    await user.click(screen.getByRole('button', { name: 'もっと見る' }))

    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('クリアボタンで setQuery("") を呼ぶ', async () => {
    const setQuery = vi.fn()
    mockUseSearch.mockReturnValue(makeState({ query: 'Next', setQuery }))
    const user = userEvent.setup()

    render(<SearchView />)
    await user.click(screen.getByRole('button', { name: '検索をクリア' }))

    expect(setQuery).toHaveBeenCalledWith('')
  })
})
