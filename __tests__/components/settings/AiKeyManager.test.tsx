/**
 * components/settings/AiKeyManager.tsx のユニットテスト。
 * 鍵登録・削除・プラン別表示・鍵形式チェックをテストする。
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// fetch をモック（鍵のテスト呼び出し）
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <div {...props}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardAction: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/dialog', () => {
  // onOpenChange は jsdom モックでは不要だが型シグネチャを合わせるため宣言だけする
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Dialog = ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) => {
    if (!open) return null
    return <div role="dialog">{children}</div>
  }
  const DialogContent = ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>
  const DialogHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const DialogTitle = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>
  const DialogFooter = ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter }
})

import { AI_KEY_STORAGE_KEYS } from '@/lib/constants/ai'
import { ERR_AI_KEY_FORMAT } from '@/lib/constants/errors'

// Node.js 25 は native localStorage を持つが getItem/setItem/clear が無い。Map ベースモックで統一する。
function makeMockLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value) }),
    removeItem: vi.fn((key: string) => { store.delete(key) }),
    clear: vi.fn(() => { store.clear() }),
    get length() { return store.size },
    key: vi.fn((i: number) => [...store.keys()][i] ?? null),
    _store: store,
  }
}

let mockStorage: ReturnType<typeof makeMockLocalStorage>

const { AiKeyManager } = await import('@/components/settings/AiKeyManager')

beforeEach(() => {
  mockStorage = makeMockLocalStorage()
  vi.stubGlobal('localStorage', mockStorage)
  vi.clearAllMocks()
  mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('fetch', mockFetch)
})

describe('AiKeyManager - プラン別表示', () => {
  it('無料プランで gemini は表示される', () => {
    render(<AiKeyManager provider="gemini" plan="free" />)
    expect(screen.getByTestId('ai-key-manager-gemini')).toBeInTheDocument()
  })

  it('無料プランで openai は非表示', () => {
    const { container } = render(<AiKeyManager provider="openai" plan="free" />)
    expect(container.firstChild).toBeNull()
  })

  it('無料プランで anthropic は非表示', () => {
    const { container } = render(<AiKeyManager provider="anthropic" plan="free" />)
    expect(container.firstChild).toBeNull()
  })

  it('有料プランで openai は表示される', () => {
    render(<AiKeyManager provider="openai" plan="paid" />)
    expect(screen.getByTestId('ai-key-manager-openai')).toBeInTheDocument()
  })

  it('有料プランで anthropic は表示される', () => {
    render(<AiKeyManager provider="anthropic" plan="paid" />)
    expect(screen.getByTestId('ai-key-manager-anthropic')).toBeInTheDocument()
  })
})

describe('AiKeyManager - 未登録状態', () => {
  it('登録ボタンが表示される', () => {
    render(<AiKeyManager provider="gemini" plan="free" />)
    expect(screen.getByTestId('ai-key-register-gemini')).toBeInTheDocument()
  })

  it('パスワード型の入力欄が表示される', () => {
    render(<AiKeyManager provider="gemini" plan="free" />)
    const input = screen.getByTestId('ai-key-input-gemini')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('鍵取得手順リンクが表示される', () => {
    render(<AiKeyManager provider="gemini" plan="free" />)
    expect(screen.getByText(/Gemini API キーの取得方法/)).toBeInTheDocument()
  })
})

describe('AiKeyManager - 形式チェック', () => {
  it('Gemini: "AIzaSy" で始まらない鍵は形式エラー', async () => {
    render(<AiKeyManager provider="gemini" plan="free" />)
    const user = userEvent.setup()

    await user.type(screen.getByTestId('ai-key-input-gemini'), 'invalid-key')
    await user.click(screen.getByTestId('ai-key-register-gemini'))

    await waitFor(() => {
      expect(screen.getByText(ERR_AI_KEY_FORMAT)).toBeInTheDocument()
    })
  })

  it('OpenAI: "sk-" で始まらない鍵は形式エラー', async () => {
    render(<AiKeyManager provider="openai" plan="paid" />)
    const user = userEvent.setup()

    await user.type(screen.getByTestId('ai-key-input-openai'), 'invalid-key')
    await user.click(screen.getByTestId('ai-key-register-openai'))

    await waitFor(() => {
      expect(screen.getByText(ERR_AI_KEY_FORMAT)).toBeInTheDocument()
    })
  })

  it('Anthropic: "sk-ant-" で始まらない鍵は形式エラー', async () => {
    render(<AiKeyManager provider="anthropic" plan="paid" />)
    const user = userEvent.setup()

    await user.type(screen.getByTestId('ai-key-input-anthropic'), 'sk-invalid-not-ant')
    await user.click(screen.getByTestId('ai-key-register-anthropic'))

    await waitFor(() => {
      expect(screen.getByText(ERR_AI_KEY_FORMAT)).toBeInTheDocument()
    })
  })
})

describe('AiKeyManager - 登録フロー', () => {
  it('Gemini: テスト呼び出し成功後に localStorage に保存される', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }))

    render(<AiKeyManager provider="gemini" plan="free" />)
    const user = userEvent.setup()

    await user.type(screen.getByTestId('ai-key-input-gemini'), 'AIzaSy-valid-test-key')
    await user.click(screen.getByTestId('ai-key-register-gemini'))

    await waitFor(() => {
      expect(mockStorage._store.get(AI_KEY_STORAGE_KEYS['gemini'])).toBe('AIzaSy-valid-test-key')
    })
  })

  it('OpenAI: 形式チェックのみで保存される', async () => {
    render(<AiKeyManager provider="openai" plan="paid" />)
    const user = userEvent.setup()

    await user.type(screen.getByTestId('ai-key-input-openai'), 'sk-valid-openai-key')
    await user.click(screen.getByTestId('ai-key-register-openai'))

    await waitFor(() => {
      expect(mockStorage._store.get(AI_KEY_STORAGE_KEYS['openai'])).toBe('sk-valid-openai-key')
    })
  })

  it('登録済み状態では削除ボタンが表示される', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-existing-key')

    render(<AiKeyManager provider="gemini" plan="free" />)

    await waitFor(() => {
      expect(screen.getByTestId('ai-key-delete-gemini')).toBeInTheDocument()
    })
  })

  it('登録済み状態では鍵が末尾4文字マスク表示される', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-key1234')

    render(<AiKeyManager provider="gemini" plan="free" />)

    await waitFor(() => {
      const input = screen.getByTestId('ai-key-input-gemini')
      expect(input).toHaveAttribute('readonly')
      const value = (input as HTMLInputElement).value
      expect(value).toContain('1234')
    })
  })
})

describe('AiKeyManager - 削除フロー', () => {
  it('削除ボタンクリックで確認ダイアログが表示される', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-key')

    render(<AiKeyManager provider="gemini" plan="free" />)
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByTestId('ai-key-delete-gemini')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('ai-key-delete-gemini'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-key-delete-confirm-dialog')).toBeInTheDocument()
    })
  })

  it('削除実行ボタンクリックで localStorage から鍵が削除される', async () => {
    mockStorage._store.set(AI_KEY_STORAGE_KEYS['gemini'], 'AIzaSy-key')

    render(<AiKeyManager provider="gemini" plan="free" />)
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByTestId('ai-key-delete-gemini')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('ai-key-delete-gemini'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-key-delete-confirm-submit')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('ai-key-delete-confirm-submit'))

    await waitFor(() => {
      expect(mockStorage._store.get(AI_KEY_STORAGE_KEYS['gemini'])).toBeUndefined()
    })
  })
})

describe('AiKeyManager - テスト呼び出しの鍵非漏洩', () => {
  it('Gemini のテスト呼び出しで fetch の URL に鍵が含まれる（正常動作だが Server に送らない）', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }))

    render(<AiKeyManager provider="gemini" plan="free" />)
    const user = userEvent.setup()

    await user.type(screen.getByTestId('ai-key-input-gemini'), 'AIzaSy-browser-only-key')
    await user.click(screen.getByTestId('ai-key-register-gemini'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // テスト呼び出しは直接プロバイダ API（Gemini）に送る。自社サーバーには送らない。
    const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(fetchCall[0]).toContain('generativelanguage.googleapis.com')
    expect(fetchCall[0]).not.toContain('localhost')
  })
})
