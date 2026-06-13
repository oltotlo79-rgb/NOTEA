import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateBrowserClient = vi.fn(() => ({ client: 'browser' }))

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
}))

const SUPABASE_URL = 'https://test.supabase.co'
const SUPABASE_ANON_KEY = 'anon-key-test'

describe('lib/supabase/client createClient', () => {
  beforeEach(() => {
    vi.resetModules()
    mockCreateBrowserClient.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  it('createBrowserClient を env の URL と anon key で呼ぶ', async () => {
    const { createClient } = await import('@/lib/supabase/client')
    createClient()

    expect(mockCreateBrowserClient).toHaveBeenCalledOnce()
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(SUPABASE_URL, SUPABASE_ANON_KEY)
  })

  it('createBrowserClient の戻り値をそのまま返す', async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const result = createClient()

    expect(result).toEqual({ client: 'browser' })
  })

  it('NEXT_PUBLIC_SUPABASE_URL が未設定なら requireEnv が throw する', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    const { createClient } = await import('@/lib/supabase/client')
    expect(() => createClient()).toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定なら requireEnv が throw する', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const { createClient } = await import('@/lib/supabase/client')
    expect(() => createClient()).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  })
})
