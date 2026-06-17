import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listShares = vi.fn()
const createShare = vi.fn()
const revokeShare = vi.fn()
vi.mock('@/lib/actions/shares', () => ({
  listShares: (...a: unknown[]) => listShares(...a),
  createShare: (...a: unknown[]) => createShare(...a),
  revokeShare: (...a: unknown[]) => revokeShare(...a),
}))

const { ShareDialog } = await import('@/components/share/ShareDialog')

const PAGE_ID = 'a0000001-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
  listShares.mockResolvedValue({ data: [] })
})

describe('ShareDialog', () => {
  it('開くと listShares を呼び、未発行なら「リンクを発行」を表示する', async () => {
    const user = userEvent.setup()
    render(<ShareDialog pageId={PAGE_ID} />)

    await user.click(screen.getByRole('button', { name: '共有' }))

    await waitFor(() => expect(listShares).toHaveBeenCalledWith({ pageId: PAGE_ID }))
    expect(screen.getByText('閲覧のみ')).toBeInTheDocument()
    expect(screen.getByText('編集可')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'リンクを発行' })).toHaveLength(2)
  })

  it('発行ボタンで createShare を呼び、URL を表示する', async () => {
    createShare.mockResolvedValueOnce({ success: true, data: { permission: 'view', token: 'tok-view-1234' } })
    const user = userEvent.setup()
    render(<ShareDialog pageId={PAGE_ID} />)

    await user.click(screen.getByRole('button', { name: '共有' }))
    await waitFor(() => expect(listShares).toHaveBeenCalled())

    const createBtns = screen.getAllByRole('button', { name: 'リンクを発行' })
    await user.click(createBtns[0]!)

    await waitFor(() => expect(createShare).toHaveBeenCalledWith({ pageId: PAGE_ID, permission: 'view' }))
    const urlInput = await screen.findByLabelText<HTMLInputElement>('閲覧のみの共有リンク')
    expect(urlInput.value).toContain('/share/tok-view-1234')
  })

  it('既存リンクがあるとき「失効」で revokeShare を呼ぶ', async () => {
    listShares.mockResolvedValue({ data: [{ permission: 'view', token: 'tok-existing' }] })
    revokeShare.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    render(<ShareDialog pageId={PAGE_ID} />)

    await user.click(screen.getByRole('button', { name: '共有' }))
    await waitFor(() => expect(screen.getByLabelText('閲覧のみの共有リンク')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '失効' }))

    await waitFor(() => expect(revokeShare).toHaveBeenCalledWith({ pageId: PAGE_ID, permission: 'view' }))
  })
})
