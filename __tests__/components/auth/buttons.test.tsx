import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '@/lib/constants/routes'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const signOut = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  signOut: () => signOut(),
}))

const signInWithOAuth = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}))

const { SignOutButton } = await import('@/components/auth/SignOutButton')
const { GoogleSignInButton } = await import('@/components/auth/GoogleSignInButton')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SignOutButton', () => {
  it('クリックでログアウトし /login へ遷移する', async () => {
    signOut.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<SignOutButton />)
    await user.click(screen.getByRole('button', { name: 'ログアウト' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith(ROUTES.LOGIN))
    expect(signOut).toHaveBeenCalled()
  })
})

describe('GoogleSignInButton', () => {
  it('クリックで Google OAuth を開始し callback へ戻す設定を渡す', async () => {
    signInWithOAuth.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    render(<GoogleSignInButton />)
    await user.click(screen.getByRole('button', { name: 'Google でログイン' }))
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled())
    const arg = signInWithOAuth.mock.calls[0]?.[0] as {
      provider: string
      options: { redirectTo: string }
    }
    expect(arg.provider).toBe('google')
    expect(arg.options.redirectTo).toContain(ROUTES.AUTH_CALLBACK)
  })
})
