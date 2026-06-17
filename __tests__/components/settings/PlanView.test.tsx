import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createCheckoutSession = vi.fn()
const createPortalSession = vi.fn()
vi.mock('@/lib/actions/billing', () => ({
  createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...a),
  createPortalSession: (...a: unknown[]) => createPortalSession(...a),
}))

const { PlanView } = await import('@/components/settings/PlanView')

const assignMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom の window.location.assign は未実装のため差し替える
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign: assignMock },
    writable: true,
  })
})

describe('PlanView（無料プラン）', () => {
  it('月額・年額のアップグレードボタンを表示する', () => {
    render(<PlanView plan="free" periodEnd={null} />)
    expect(screen.getByText('月額プラン')).toBeInTheDocument()
    expect(screen.getByText('年額プラン')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'このプランにする' })).toHaveLength(2)
  })

  it('アップグレードで createCheckoutSession を呼び返り URL へ遷移する', async () => {
    createCheckoutSession.mockResolvedValueOnce({ success: true, data: { url: 'https://checkout/x' } })
    const user = userEvent.setup()
    render(<PlanView plan="free" periodEnd={null} />)

    await user.click(screen.getAllByRole('button', { name: 'このプランにする' })[0]!)

    await waitFor(() => expect(createCheckoutSession).toHaveBeenCalledWith({ plan: 'monthly' }))
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('https://checkout/x'))
  })

  it('エラー時はメッセージを表示する', async () => {
    createCheckoutSession.mockResolvedValueOnce({ success: false, error: '決済の準備に失敗' })
    const user = userEvent.setup()
    render(<PlanView plan="free" periodEnd={null} />)

    await user.click(screen.getAllByRole('button', { name: 'このプランにする' })[1]!)

    expect(await screen.findByText('決済の準備に失敗')).toBeInTheDocument()
    expect(assignMock).not.toHaveBeenCalled()
  })
})

describe('PlanView（有料プラン）', () => {
  it('管理ボタンと更新日を表示する', () => {
    render(<PlanView plan="paid" periodEnd="2026-12-31T00:00:00.000Z" />)
    expect(screen.getByText('プレミアムプラン 利用中')).toBeInTheDocument()
    expect(screen.getByText(/次回更新日/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /お支払い・解約の管理/ })).toBeInTheDocument()
  })

  it('管理ボタンで createPortalSession を呼び遷移する', async () => {
    createPortalSession.mockResolvedValueOnce({ success: true, data: { url: 'https://billing/y' } })
    const user = userEvent.setup()
    render(<PlanView plan="paid" periodEnd={null} />)

    await user.click(screen.getByRole('button', { name: /お支払い・解約の管理/ }))

    await waitFor(() => expect(createPortalSession).toHaveBeenCalled())
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('https://billing/y'))
  })
})
