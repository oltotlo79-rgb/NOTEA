import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ERR_SIGNUP_FAILED } from '@/lib/constants/errors'
import { ROUTES } from '@/lib/constants/routes'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

const signUp = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  signUp: (...args: unknown[]) => signUp(...args),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }),
}))

const { RegisterForm } = await import('@/components/auth/RegisterForm')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RegisterForm', () => {
  it('登録成功で確認メール案内ページへ遷移する', async () => {
    signUp.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<RegisterForm />)
    await user.type(screen.getByLabelText('メールアドレス'), 'a@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'abcde123')
    await user.click(screen.getByRole('button', { name: '登録する' }))
    expect(signUp).toHaveBeenCalledWith({ email: 'a@example.com', password: 'abcde123' })
    expect(push).toHaveBeenCalledWith(ROUTES.VERIFY_EMAIL_SENT)
  })

  it('ポリシー違反パスワードはクライアント側で弾き signUp を呼ばない', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    await user.type(screen.getByLabelText('メールアドレス'), 'a@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'short1')
    await user.click(screen.getByRole('button', { name: '登録する' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('8文字以上')
    expect(signUp).not.toHaveBeenCalled()
  })

  it('サーバーエラーを表示する', async () => {
    signUp.mockResolvedValue({ success: false, error: ERR_SIGNUP_FAILED })
    const user = userEvent.setup()
    render(<RegisterForm />)
    await user.type(screen.getByLabelText('メールアドレス'), 'a@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'abcde123')
    await user.click(screen.getByRole('button', { name: '登録する' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('登録に失敗')
    expect(push).not.toHaveBeenCalled()
  })
})
