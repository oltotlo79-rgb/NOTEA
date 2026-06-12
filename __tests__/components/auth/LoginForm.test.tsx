import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ERR_LOGIN_FAILED } from '@/lib/constants/errors'

const push = vi.fn()
const refresh = vi.fn()
let searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => searchParams,
}))

const signIn = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  signIn: (...args: unknown[]) => signIn(...args),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }),
}))

const { LoginForm } = await import('@/components/auth/LoginForm')

beforeEach(() => {
  vi.clearAllMocks()
  searchParams = new URLSearchParams()
})

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('メールアドレス'), 'a@example.com')
  await user.type(screen.getByLabelText('パスワード'), 'abcde123')
  await user.click(screen.getByRole('button', { name: 'ログイン' }))
  return user
}

describe('LoginForm', () => {
  it('ログイン成功で /pages へ遷移する', async () => {
    signIn.mockResolvedValue({ success: true })
    render(<LoginForm />)
    await fillAndSubmit()
    expect(signIn).toHaveBeenCalledWith({ email: 'a@example.com', password: 'abcde123' })
    expect(push).toHaveBeenCalledWith('/pages')
  })

  it('redirectTo があればそこへ戻す', async () => {
    searchParams = new URLSearchParams('redirectTo=%2Fpages%2Fabc')
    signIn.mockResolvedValue({ success: true })
    render(<LoginForm />)
    await fillAndSubmit()
    expect(push).toHaveBeenCalledWith('/pages/abc')
  })

  it('外部 URL の redirectTo は無視して /pages へ', async () => {
    searchParams = new URLSearchParams('redirectTo=https%3A%2F%2Fevil.example.com')
    signIn.mockResolvedValue({ success: true })
    render(<LoginForm />)
    await fillAndSubmit()
    expect(push).toHaveBeenCalledWith('/pages')
  })

  it('失敗時はエラーを表示し遷移しない', async () => {
    signIn.mockResolvedValue({ success: false, error: ERR_LOGIN_FAILED })
    render(<LoginForm />)
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('正しくありません')
    expect(push).not.toHaveBeenCalled()
  })
})
