import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const EXPANDED_KEY = 'notea_sidebar_expanded'
const COLLAPSED_KEY = 'notea_sidebar_collapsed'

// localStorage を Map ベースのモックで差し替える
function makeMockLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    get length() { return store.size },
    key: vi.fn((i: number) => [...store.keys()][i] ?? null),
    _store: store,
  }
}

let mockStorage: ReturnType<typeof makeMockLocalStorage>

// useSidebarState は localStorage を初期化時に読む関数を含むため、
// 各テスト前にモックをセットアップしてからモジュールを再インポートする
beforeEach(async () => {
  mockStorage = makeMockLocalStorage()
  vi.stubGlobal('localStorage', mockStorage)
  vi.resetModules()
})

describe('useSidebarState', () => {
  describe('isExpanded / toggle', () => {
    it('初期状態は全て折りたたみ', async () => {
      const { useSidebarState } = await import('@/hooks/use-sidebar-state')
      const { result } = renderHook(() => useSidebarState())
      expect(result.current.isExpanded('id-1')).toBe(false)
    })

    it('toggle で展開→折りたたみ→展開を繰り返す', async () => {
      const { useSidebarState } = await import('@/hooks/use-sidebar-state')
      const { result } = renderHook(() => useSidebarState())

      act(() => { result.current.toggle('id-1') })
      expect(result.current.isExpanded('id-1')).toBe(true)

      act(() => { result.current.toggle('id-1') })
      expect(result.current.isExpanded('id-1')).toBe(false)
    })

    it('複数 ID を独立して管理できる', async () => {
      const { useSidebarState } = await import('@/hooks/use-sidebar-state')
      const { result } = renderHook(() => useSidebarState())

      act(() => { result.current.toggle('id-1') })
      expect(result.current.isExpanded('id-1')).toBe(true)
      expect(result.current.isExpanded('id-2')).toBe(false)

      act(() => { result.current.toggle('id-2') })
      expect(result.current.isExpanded('id-1')).toBe(true)
      expect(result.current.isExpanded('id-2')).toBe(true)
    })

    it('toggle 後に localStorage に保存される', async () => {
      const { useSidebarState } = await import('@/hooks/use-sidebar-state')
      const { result } = renderHook(() => useSidebarState())

      act(() => { result.current.toggle('id-1') })

      expect(mockStorage.setItem).toHaveBeenCalled()
      const stored = mockStorage._store.get(EXPANDED_KEY)
      expect(stored).not.toBeUndefined()
      const parsed: unknown = JSON.parse(stored!)
      expect(Array.isArray(parsed) && parsed).toContain('id-1')
    })

    it('localStorage に保存されている状態から復元する', async () => {
      mockStorage._store.set(EXPANDED_KEY, JSON.stringify(['id-saved']))
      const { useSidebarState } = await import('@/hooks/use-sidebar-state')
      const { result } = renderHook(() => useSidebarState())
      expect(result.current.isExpanded('id-saved')).toBe(true)
      expect(result.current.isExpanded('id-other')).toBe(false)
    })

    it('localStorage に不正な値がある場合は空状態で始まる', async () => {
      mockStorage._store.set(EXPANDED_KEY, 'invalid-json{{{')
      const { useSidebarState } = await import('@/hooks/use-sidebar-state')
      const { result } = renderHook(() => useSidebarState())
      expect(result.current.isExpanded('any-id')).toBe(false)
    })
  })

  describe('isSidebarCollapsed / toggleSidebar', () => {
    it('初期状態は展開（collapsed=false）', async () => {
      const { useSidebarState } = await import('@/hooks/use-sidebar-state')
      const { result } = renderHook(() => useSidebarState())
      expect(result.current.isSidebarCollapsed).toBe(false)
    })

    it('toggleSidebar で折りたたみ→展開を切り替える', async () => {
      const { useSidebarState } = await import('@/hooks/use-sidebar-state')
      const { result } = renderHook(() => useSidebarState())

      act(() => { result.current.toggleSidebar() })
      expect(result.current.isSidebarCollapsed).toBe(true)

      act(() => { result.current.toggleSidebar() })
      expect(result.current.isSidebarCollapsed).toBe(false)
    })

    it('toggleSidebar 後に localStorage に保存される', async () => {
      const { useSidebarState } = await import('@/hooks/use-sidebar-state')
      const { result } = renderHook(() => useSidebarState())

      act(() => { result.current.toggleSidebar() })

      expect(mockStorage.setItem).toHaveBeenCalled()
      expect(mockStorage._store.get(COLLAPSED_KEY)).toBe('true')
    })

    it('localStorage に保存されている折りたたみ状態から復元する', async () => {
      mockStorage._store.set(COLLAPSED_KEY, 'true')
      const { useSidebarState } = await import('@/hooks/use-sidebar-state')
      const { result } = renderHook(() => useSidebarState())
      expect(result.current.isSidebarCollapsed).toBe(true)
    })
  })
})
