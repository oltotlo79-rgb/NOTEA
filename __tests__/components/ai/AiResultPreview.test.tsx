/**
 * components/ai/AiResultPreview.tsx のユニットテスト。
 * 状態別表示（loading/streaming/done/error）・アクションボタンをテストする。
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Dialog コンポーネントのポータルを jsdom で動作させるためのスタブ
vi.mock('@/components/ui/dialog', () => {
  // onOpenChange は jsdom モックでは不要だが型シグネチャを合わせるため宣言だけする
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Dialog = ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) => {
    if (!open) return null
    return <div role="dialog" aria-modal="true">{children}</div>
  }
  const DialogContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const DialogHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const DialogTitle = ({ children, id }: { children: React.ReactNode; id?: string }) => <h2 id={id}>{children}</h2>
  const DialogFooter = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter }
})

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import React from 'react'
const { AiResultPreview } = await import('@/components/ai/AiResultPreview')

function makeTextStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      for (const chunk of chunks) {
        await new Promise((r) => setTimeout(r, 0))
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

const DEFAULT_PROPS = {
  open: true,
  operation: 'summarize' as const,
  stream: null,
  errorMessage: undefined,
  targetLanguage: undefined,
  sourceText: undefined,
  onInsert: vi.fn(),
  onReplace: vi.fn(),
  onDiscard: vi.fn(),
  onRetry: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AiResultPreview - ローディング状態', () => {
  it('stream=null のとき「生成中...」を表示する', () => {
    render(<AiResultPreview {...DEFAULT_PROPS} />)
    expect(screen.getByText('生成中...')).toBeInTheDocument()
  })

  it('ローディング中はアクションボタンが無効化される', () => {
    render(<AiResultPreview {...DEFAULT_PROPS} />)
    const applyBtn = screen.getByTestId('ai-result-apply')
    expect(applyBtn).toBeDisabled()
  })

  it('ローディング中でも「破棄」ボタンは有効', () => {
    render(<AiResultPreview {...DEFAULT_PROPS} />)
    const discardBtn = screen.getByTestId('ai-result-discard')
    expect(discardBtn).toBeEnabled()
  })
})

describe('AiResultPreview - エラー状態', () => {
  it('errorMessage がある場合にエラーメッセージを表示する', async () => {
    render(
      <AiResultPreview
        {...DEFAULT_PROPS}
        errorMessage="API キーが無効です"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('API キーが無効です')).toBeInTheDocument()
    })
  })

  it('エラー時に「再試行」ボタンを表示する', async () => {
    render(
      <AiResultPreview
        {...DEFAULT_PROPS}
        errorMessage="ネットワークエラー"
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('ai-result-retry')).toBeInTheDocument()
    })
  })

  it('「再試行」ボタンクリックで onRetry が呼ばれる', async () => {
    const onRetry = vi.fn()
    render(
      <AiResultPreview
        {...DEFAULT_PROPS}
        errorMessage="エラー"
        onRetry={onRetry}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('ai-result-retry')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('ai-result-retry'))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('AiResultPreview - 完了状態', () => {
  it('stream 完了後に生成テキストを表示する', async () => {
    const stream = makeTextStream(['テスト', '応答'])
    render(<AiResultPreview {...DEFAULT_PROPS} stream={stream} />)

    await waitFor(() => {
      const textEl = screen.queryByTestId('ai-result-text')
      expect(textEl).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('stream 完了後に「破棄」ボタンが有効になる', async () => {
    const stream = makeTextStream(['テキスト'])
    render(<AiResultPreview {...DEFAULT_PROPS} stream={stream} />)

    await waitFor(() => {
      expect(screen.getByTestId('ai-result-discard')).toBeEnabled()
    }, { timeout: 3000 })
  })
})

describe('AiResultPreview - 操作ラベル', () => {
  it('summarize 操作では「ページ末尾に挿入」ボタン', () => {
    // stream を完了状態にしてボタンを有効化
    render(<AiResultPreview {...DEFAULT_PROPS} operation="summarize" />)
    expect(screen.getByTestId('ai-result-apply')).toHaveTextContent('ページ末尾に挿入')
  })

  it('continue 操作では「カーソル位置に挿入」ボタン', () => {
    render(<AiResultPreview {...DEFAULT_PROPS} operation="continue" />)
    expect(screen.getByTestId('ai-result-apply')).toHaveTextContent('カーソル位置に挿入')
  })

  it('translate 操作では「選択範囲を置換」ボタン', () => {
    render(<AiResultPreview {...DEFAULT_PROPS} operation="translate" />)
    expect(screen.getByTestId('ai-result-apply')).toHaveTextContent('選択範囲を置換')
  })
})

describe('AiResultPreview - 「破棄」ボタン', () => {
  it('「破棄」クリックで onDiscard が呼ばれる', async () => {
    const onDiscard = vi.fn()
    render(<AiResultPreview {...DEFAULT_PROPS} onDiscard={onDiscard} />)
    const user = userEvent.setup()
    await user.click(screen.getByTestId('ai-result-discard'))
    expect(onDiscard).toHaveBeenCalled()
  })
})

describe('AiResultPreview - タイトル', () => {
  it('summarize 操作のタイトルに「要約」を含む', () => {
    render(<AiResultPreview {...DEFAULT_PROPS} operation="summarize" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.body.textContent).toContain('要約')
  })

  it('translate 操作でターゲット言語が指定されたとき言語名をタイトルに含む', () => {
    render(
      <AiResultPreview
        {...DEFAULT_PROPS}
        operation="translate"
        targetLanguage="英語"
      />
    )
    expect(document.body.textContent).toContain('英語')
  })
})

describe('AiResultPreview - 翻訳時の元テキスト表示', () => {
  it('translate 操作で sourceText がある場合に元テキストを表示する', () => {
    render(
      <AiResultPreview
        {...DEFAULT_PROPS}
        operation="translate"
        sourceText="元の日本語テキスト"
      />
    )
    expect(document.body.textContent).toContain('元の日本語テキスト')
    expect(document.body.textContent).toContain('元のテキスト')
  })

  it('summarize 操作では元テキスト表示なし', () => {
    render(
      <AiResultPreview
        {...DEFAULT_PROPS}
        operation="summarize"
        sourceText="元テキスト"
      />
    )
    expect(document.body.textContent).not.toContain('元のテキスト')
  })
})
