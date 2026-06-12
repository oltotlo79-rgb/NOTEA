import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ERR_PASSWORD_UPDATE_FAILED } from '@/lib/constants/errors'
import { ROUTES } from '@/lib/constants/routes'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

const requestPasswordReset = vi.fn()
const updatePassword = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
  updatePassword: (...args: unknown[]) => updatePassword(...args),
}))

const { PasswordResetRequestForm } = await import('@/components/auth/PasswordResetRequestForm')
const { PasswordResetConfirmForm } = await import('@/components/auth/PasswordResetConfirmForm')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PasswordResetRequestForm', () => {
  it('送信後に完了メッセージを表示する', async () => {
    requestPasswordReset.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PasswordResetRequestForm />)
    await user.type(screen.getByLabelText('メールアドレス'), 'a@example.com')
    await user.click(screen.getByRole('button', { name: '再設定メールを送る' }))
    expect(await screen.findByText(/メールを送信しました/)).toBeInTheDocument()
    expect(requestPasswordReset).toHaveBeenCalledWith({ email: 'a@example.com' })
  })
})

describe('PasswordResetConfirmForm', () => {
  it('更新成功で /pages へ遷移する', async () => {
    updatePassword.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)
    await user.type(screen.getByLabelText('新しいパスワード'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }))
    expect(updatePassword).toHaveBeenCalledWith({ password: 'newpass123' })
    expect(push).toHaveBeenCalledWith(ROUTES.PAGES)
  })

  it('ポリシー違反はクライアント側で弾き updatePassword を呼ばない', async () => {
    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)
    await user.type(screen.getByLabelText('新しいパスワード'), 'short1')
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('8文字以上')
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('サーバーエラーを表示する', async () => {
    updatePassword.mockResolvedValue({ success: false, error: ERR_PASSWORD_UPDATE_FAILED })
    const user = userEvent.setup()
    render(<PasswordResetConfirmForm />)
    await user.type(screen.getByLabelText('新しいパスワード'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'パスワードを更新' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('更新に失敗')
    expect(push).not.toHaveBeenCalled()
  })
})
