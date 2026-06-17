/**
 * @module __tests__/components/share/SharedEditor.test.tsx
 * SharedEditor.tsx の配線ロジックテスト。BlockNote は jsdom 未対応のため vi.mock でスタブし、
 * useCreateBlockNote に渡す resolveFileUrl / onChange を取り出して検証する。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

type CapturedOptions = {
  resolveFileUrl?: (url: string) => Promise<string>
  onChange?: () => void
  editable?: boolean
}

const captured: CapturedOptions = {}

const mockEditorInstance = {
  document: [{ type: 'paragraph', content: [] }],
  blocksToMarkdownLossy: vi.fn(() => 'md'),
}

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote: vi.fn((options: CapturedOptions) => {
    captured.resolveFileUrl = options.resolveFileUrl
    return mockEditorInstance
  }),
  BlockNoteViewRaw: vi.fn(
    ({ onChange, editable }: { onChange?: () => void; editable?: boolean }) => {
      captured.onChange = onChange
      captured.editable = editable
      return null
    }
  ),
}))

vi.mock('@blocknote/core', () => ({}))

const mockGetSharedImageUrl = vi.fn()
vi.mock('@/lib/actions/shared-pages', () => ({
  getSharedImageUrl: (...args: unknown[]) => mockGetSharedImageUrl(...args),
}))

import { render } from '@testing-library/react'
const { SharedEditor } = await import('@/components/share/SharedEditor')

const TOKEN = 'abcdefghijklmnop1234'

beforeEach(() => {
  vi.clearAllMocks()
})

function renderEditor(props: Partial<{ editable: boolean; onContentChange: () => void }> = {}) {
  render(
    <SharedEditor
      token={TOKEN}
      initialContent={null}
      editable={props.editable ?? false}
      onContentChange={props.onContentChange}
    />
  )
}

describe('SharedEditor resolveFileUrl', () => {
  it('http URL はそのまま返し getSharedImageUrl を呼ばない', async () => {
    renderEditor()
    const result = await captured.resolveFileUrl!('https://cdn.example.com/i.webp')
    expect(result).toBe('https://cdn.example.com/i.webp')
    expect(mockGetSharedImageUrl).not.toHaveBeenCalled()
  })

  it('storage path は getSharedImageUrl(token, path) で署名URLに解決する', async () => {
    mockGetSharedImageUrl.mockResolvedValueOnce({ url: 'https://signed.example/i.webp' })
    renderEditor()
    const result = await captured.resolveFileUrl!('owner/page/i.webp')
    expect(mockGetSharedImageUrl).toHaveBeenCalledWith({ token: TOKEN, path: 'owner/page/i.webp' })
    expect(result).toBe('https://signed.example/i.webp')
  })

  it('解決に失敗したら path をそのまま返す', async () => {
    mockGetSharedImageUrl.mockResolvedValueOnce({ url: null, error: 'x' })
    renderEditor()
    const result = await captured.resolveFileUrl!('owner/page/i.webp')
    expect(result).toBe('owner/page/i.webp')
  })
})

describe('SharedEditor editable / onChange 配線', () => {
  it('editable=false のとき BlockNote に editable=false を渡す', () => {
    renderEditor({ editable: false })
    expect(captured.editable).toBe(false)
  })

  it('editable=true + onContentChange で onChange 配線され content を渡す', () => {
    const onContentChange = vi.fn()
    renderEditor({ editable: true, onContentChange })
    expect(captured.editable).toBe(true)
    captured.onChange!()
    expect(onContentChange).toHaveBeenCalledOnce()
    const [contentArg] = onContentChange.mock.calls[0] as [unknown[], string]
    expect(contentArg).toEqual(mockEditorInstance.document)
  })
})
