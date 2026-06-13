import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateSupabaseClient = vi.fn(() => ({ client: 'admin' }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateSupabaseClient,
}))

const SUPABASE_URL = 'https://test.supabase.co'
const SERVICE_ROLE_KEY = 'service-role-key-test'

describe('lib/supabase/admin createAdminClient', () => {
  beforeEach(() => {
    vi.resetModules()
    mockCreateSupabaseClient.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it('SERVICE_ROLE_KEY と autoRefreshToken=false, persistSession=false で createClient を呼ぶ', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    createAdminClient()

    expect(mockCreateSupabaseClient).toHaveBeenCalledOnce()
    expect(mockCreateSupabaseClient).toHaveBeenCalledWith(
      SUPABASE_URL,
      SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  })

  it('createClient の戻り値をそのまま返す', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const result = createAdminClient()

    expect(result).toEqual({ client: 'admin' })
  })

  it('NEXT_PUBLIC_SUPABASE_URL が未設定なら requireEnv が throw する', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    const { createAdminClient } = await import('@/lib/supabase/admin')
    expect(() => createAdminClient()).toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('SUPABASE_SERVICE_ROLE_KEY が未設定なら requireEnv が throw する', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const { createAdminClient } = await import('@/lib/supabase/admin')
    expect(() => createAdminClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY')
  })
})
