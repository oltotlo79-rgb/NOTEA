import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/share/SharedEditorDynamic', () => ({
  SharedEditorDynamic: (props: { editable: boolean }) => (
    <div data-testid="shared-editor" data-editable={String(props.editable)} />
  ),
}))

const updateSharedPageContent = vi.fn()
vi.mock('@/lib/actions/shared-pages', () => ({
  updateSharedPageContent: (...a: unknown[]) => updateSharedPageContent(...a),
}))

const { SharedPageView } = await import('@/components/share/SharedPageView')

const TOKEN = 'abcdefghijklmnop1234'

function makePage(permission: 'view' | 'edit') {
  return {
    id: 'a0000001-0000-4000-8000-000000000001',
    title: '共有ドキュメント',
    icon: '📘',
    content: [],
    contentText: '',
    updatedAt: '2026-06-17T00:00:00.000Z',
    permission,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SharedPageView', () => {
  it('タイトルとアイコンを描画する', () => {
    render(<SharedPageView token={TOKEN} page={makePage('view')} canEdit={false} />)
    expect(screen.getByText('共有ドキュメント')).toBeInTheDocument()
    expect(screen.getByText('📘')).toBeInTheDocument()
  })

  it('view リンクは編集不可（editable=false）でログイン案内も出さない', () => {
    render(<SharedPageView token={TOKEN} page={makePage('view')} canEdit={false} />)
    expect(screen.getByTestId('shared-editor')).toHaveAttribute('data-editable', 'false')
    expect(screen.queryByText(/編集するには/)).not.toBeInTheDocument()
  })

  it('edit リンクで未ログイン（canEdit=false）はログイン案内を表示し編集不可', () => {
    render(<SharedPageView token={TOKEN} page={makePage('edit')} canEdit={false} />)
    expect(screen.getByText(/編集するには/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ログイン' })).toBeInTheDocument()
    expect(screen.getByTestId('shared-editor')).toHaveAttribute('data-editable', 'false')
  })

  it('edit リンクでログイン済み（canEdit=true）は編集可能で「共有編集中」を表示する', () => {
    render(<SharedPageView token={TOKEN} page={makePage('edit')} canEdit={true} />)
    expect(screen.getByText('共有編集中')).toBeInTheDocument()
    expect(screen.getByTestId('shared-editor')).toHaveAttribute('data-editable', 'true')
    expect(screen.queryByText(/編集するには/)).not.toBeInTheDocument()
  })
})
