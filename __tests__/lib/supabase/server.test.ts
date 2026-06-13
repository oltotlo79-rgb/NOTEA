import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// cookies ハンドラを捕捉するためにモック createServerClient の引数を記録する
type CookiesConfig = {
  getAll: () => { name: string; value: string }[]
  setAll: (cookiesToSet: { name: string; value: string; options?: unknown }[]) => void
}

let capturedCookiesConfig: CookiesConfig | undefined

const mockCreateServerClient = vi.fn(
  (_url: string, _key: string, config: { cookies: CookiesConfig }) => {
    capturedCookiesConfig = config.cookies
    return { client: 'server' }
  }
)

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}))

// next/headers の cookies() をモック
const mockCookieStore = {
  getAll: vi.fn(() => [{ name: 'sb-token', value: 'tok123' }]),
  set: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}))

const SUPABASE_URL = 'https://test.supabase.co'
const SUPABASE_ANON_KEY = 'anon-key-test'

describe('lib/supabase/server createClient', () => {
  beforeEach(() => {
    vi.resetModules()
    mockCreateServerClient.mockClear()
    mockCookieStore.getAll.mockClear()
    mockCookieStore.set.mockClear()
    capturedCookiesConfig = undefined
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  it('createServerClient を env の URL と anon key で呼ぶ', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    await createClient()

    expect(mockCreateServerClient).toHaveBeenCalledOnce()
    const firstCall = mockCreateServerClient.mock.calls[0]
    expect(firstCall).toBeDefined()
    const [url, key] = firstCall!
    expect(url).toBe(SUPABASE_URL)
    expect(key).toBe(SUPABASE_ANON_KEY)
  })

  it('cookies ハンドラ getAll が cookieStore.getAll() を返す', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    await createClient()

    expect(capturedCookiesConfig).toBeDefined()
    const result = capturedCookiesConfig!.getAll()
    expect(result).toEqual([{ name: 'sb-token', value: 'tok123' }])
    expect(mockCookieStore.getAll).toHaveBeenCalled()
  })

  it('cookies ハンドラ setAll が cookieStore.set を呼ぶ（正常系）', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    await createClient()

    expect(capturedCookiesConfig).toBeDefined()
    capturedCookiesConfig!.setAll([
      { name: 'sb-access-token', value: 'access123', options: { path: '/' } },
      { name: 'sb-refresh-token', value: 'refresh456', options: { path: '/' } },
    ])

    expect(mockCookieStore.set).toHaveBeenCalledTimes(2)
    expect(mockCookieStore.set).toHaveBeenCalledWith('sb-access-token', 'access123', {
      path: '/',
    })
    expect(mockCookieStore.set).toHaveBeenCalledWith('sb-refresh-token', 'refresh456', {
      path: '/',
    })
  })

  it('cookies ハンドラ setAll: cookieStore.set が throw しても握りつぶす（Server Component 対応）', async () => {
    mockCookieStore.set.mockImplementationOnce(() => {
      throw new Error('Cannot set cookies in Server Component')
    })

    const { createClient } = await import('@/lib/supabase/server')
    await createClient()

    expect(capturedCookiesConfig).toBeDefined()
    // throw しても setAll 自体は例外を外に伝えない
    expect(() =>
      capturedCookiesConfig!.setAll([{ name: 'token', value: 'val', options: {} }])
    ).not.toThrow()
  })

  it('NEXT_PUBLIC_SUPABASE_URL が未設定なら requireEnv が throw する', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    const { createClient } = await import('@/lib/supabase/server')
    await expect(createClient()).rejects.toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定なら requireEnv が throw する', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const { createClient } = await import('@/lib/supabase/server')
    await expect(createClient()).rejects.toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  })
})
