import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'

const mockRouterPush = vi.fn()
const mockCreatePage = vi.fn()
const mockToggleSidebar = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}))

vi.mock('@/lib/actions/pages', () => ({
  createPage: (...args: unknown[]) => mockCreatePage(...args),
  updatePageMeta: vi.fn(),
  trashPage: vi.fn(),
  restorePage: vi.fn(),
  deletePagePermanently: vi.fn(),
  movePage: vi.fn(),
  reorderPage: vi.fn(),
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
  return { queryClient, wrapper: Wrapper }
}

// 動的インポートでモジュールキャッシュを回避
const { useGlobalShortcuts } = await import('@/hooks/use-global-shortcuts')

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルトで成功を返す（undefined にならないようにする）
    mockCreatePage.mockResolvedValue({ success: false, error: 'not called' })
  })

  it('Ctrl+N で createPage が呼ばれる', async () => {
    mockCreatePage.mockResolvedValueOnce({ success: true, data: { id: 'page-1' } })
    const { wrapper } = makeWrapper()
    renderHook(() => useGlobalShortcuts({ onToggleSidebar: mockToggleSidebar }), { wrapper })

    const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(mockCreatePage).toHaveBeenCalled()
    })
  })

  it('Cmd+N でも createPage が呼ばれる（metaKey）', async () => {
    mockCreatePage.mockResolvedValueOnce({ success: true, data: { id: 'page-1' } })
    const { wrapper } = makeWrapper()
    renderHook(() => useGlobalShortcuts({ onToggleSidebar: mockToggleSidebar }), { wrapper })

    const event = new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(mockCreatePage).toHaveBeenCalled()
    })
  })

  it('createPage 成功後に router.push が呼ばれる', async () => {
    mockCreatePage.mockResolvedValueOnce({ success: true, data: { id: 'page-abc' } })
    const { wrapper } = makeWrapper()
    renderHook(() => useGlobalShortcuts({ onToggleSidebar: mockToggleSidebar }), { wrapper })

    const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true })
    document.dispatchEvent(event)

    await vi.waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(expect.stringContaining('page-abc'))
    })
  })

  it('Ctrl+, で設定ページへ遷移する', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useGlobalShortcuts({ onToggleSidebar: mockToggleSidebar }), { wrapper })

    const event = new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true })
    document.dispatchEvent(event)

    expect(mockRouterPush).toHaveBeenCalledWith('/settings')
  })

  it('Ctrl+\\ でサイドバートグルが呼ばれる', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useGlobalShortcuts({ onToggleSidebar: mockToggleSidebar }), { wrapper })

    const event = new KeyboardEvent('keydown', { key: '\\', ctrlKey: true, bubbles: true })
    document.dispatchEvent(event)

    expect(mockToggleSidebar).toHaveBeenCalled()
  })

  it('Ctrl なしのキーは発動しない', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useGlobalShortcuts({ onToggleSidebar: mockToggleSidebar }), { wrapper })

    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true })
    document.dispatchEvent(event)

    expect(mockCreatePage).not.toHaveBeenCalled()
    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(mockToggleSidebar).not.toHaveBeenCalled()
  })

  it('input 要素にフォーカス中は発動しない', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useGlobalShortcuts({ onToggleSidebar: mockToggleSidebar }), { wrapper })

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    // input 要素から bubble させることで target が正しくセットされる
    const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true })
    input.dispatchEvent(event)

    expect(mockCreatePage).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })

  it('textarea 要素にフォーカス中は発動しない', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useGlobalShortcuts({ onToggleSidebar: mockToggleSidebar }), { wrapper })

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    // textarea から bubble させることで target が正しくセットされる
    const event = new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true })
    textarea.dispatchEvent(event)

    expect(mockRouterPush).not.toHaveBeenCalled()

    document.body.removeChild(textarea)
  })

  // jsdom では div.isContentEditable が undefined になるため、
  // contenteditable の無効化は E2E（editor.spec.ts）で結合テストとして覆う。
  // ここでは isContentEditable を手動でスタブして本番コードのロジックを検証する。
  it('isContentEditable=true の要素にフォーカス中は発動しない', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useGlobalShortcuts({ onToggleSidebar: mockToggleSidebar }), { wrapper })

    const div = document.createElement('div')
    // jsdom では isContentEditable が undefined なのでスタブで true を返すプロパティを設定
    Object.defineProperty(div, 'isContentEditable', { get: () => true, configurable: true })
    document.body.appendChild(div)

    const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true })
    div.dispatchEvent(event)

    expect(mockCreatePage).not.toHaveBeenCalled()

    document.body.removeChild(div)
  })

  it('アンマウント後はイベントリスナーが削除される', () => {
    const { wrapper } = makeWrapper()
    const { unmount } = renderHook(
      () => useGlobalShortcuts({ onToggleSidebar: mockToggleSidebar }),
      { wrapper }
    )

    unmount()

    const event = new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true })
    document.dispatchEvent(event)

    expect(mockRouterPush).not.toHaveBeenCalled()
  })
})
