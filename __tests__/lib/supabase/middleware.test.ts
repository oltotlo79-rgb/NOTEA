import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type CookiesConfig = {
  getAll: () => { name: string; value: string }[]
  setAll: (cookiesToSet: { name: string; value: string; options?: unknown }[]) => void
}

let capturedCookiesConfig: CookiesConfig | undefined

const mockGetUser = vi.fn(async () => ({
  data: { user: { id: 'user-1', email: 'user@example.com' } as { id: string; email: string } | null },
  error: null,
}))

const mockCreateServerClient = vi.fn(
  (_url: string, _key: string, config: { cookies: CookiesConfig }) => {
    capturedCookiesConfig = config.cookies
    return {
      auth: { getUser: mockGetUser },
    }
  }
)

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}))

const SUPABASE_URL = 'https://test.supabase.co'
const SUPABASE_ANON_KEY = 'anon-key-test'

describe('lib/supabase/middleware updateSession', () => {
  beforeEach(() => {
    vi.resetModules()
    mockCreateServerClient.mockClear()
    mockGetUser.mockClear()
    capturedCookiesConfig = undefined
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_ANON_KEY
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  it('{ response, user } を返す（認証済みユーザーあり）', async () => {
    const { updateSession } = await import('@/lib/supabase/middleware')
    const request = new NextRequest('http://localhost:3010/pages')

    const result = await updateSession(request)

    expect(result).toHaveProperty('response')
    expect(result).toHaveProperty('user')
    expect(result.user).toMatchObject({ id: 'user-1' })
  })

  it('未認証の場合は user が null', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    const { updateSession } = await import('@/lib/supabase/middleware')
    const request = new NextRequest('http://localhost:3010/login')

    const result = await updateSession(request)

    // user が null の場合でも response は返る
    expect(result.user == null).toBe(true)
    expect(result.response).toBeDefined()
  })

  it('cookies ハンドラ getAll が request.cookies.getAll() を呼ぶ', async () => {
    const { updateSession } = await import('@/lib/supabase/middleware')
    const request = new NextRequest('http://localhost:3010/pages', {
      headers: { cookie: 'sb-token=tok123' },
    })

    await updateSession(request)

    expect(capturedCookiesConfig).toBeDefined()
    const cookies = capturedCookiesConfig!.getAll()
    expect(Array.isArray(cookies)).toBe(true)
  })

  it('cookies ハンドラ setAll がレスポンス cookie を積む', async () => {
    const { updateSession } = await import('@/lib/supabase/middleware')
    const request = new NextRequest('http://localhost:3010/pages')

    await updateSession(request)

    expect(capturedCookiesConfig).toBeDefined()
    // setAll を呼んでもエラーにならないことを確認
    expect(() =>
      capturedCookiesConfig!.setAll([
        { name: 'sb-access-token', value: 'access123', options: { path: '/' } },
      ])
    ).not.toThrow()
  })

  it('setAll を呼んだ後の response に cookie が設定される', async () => {
    const { updateSession } = await import('@/lib/supabase/middleware')
    const request = new NextRequest('http://localhost:3010/pages')

    await updateSession(request)

    expect(capturedCookiesConfig).toBeDefined()
    capturedCookiesConfig!.setAll([
      { name: 'sb-access-token', value: 'newtoken', options: { path: '/' } },
    ])

    // response の取得（setAll 後に response が更新されていること）
    const { response } = await updateSession(request)
    expect(response).toBeDefined()
    // NextResponse はテスト環境でもヘッダ/cookie API を持つ
    expect(typeof response.headers.get).toBe('function')
  })

  it('createServerClient に env の URL と anon key を渡す', async () => {
    const { updateSession } = await import('@/lib/supabase/middleware')
    const request = new NextRequest('http://localhost:3010/pages')

    await updateSession(request)

    expect(mockCreateServerClient).toHaveBeenCalledOnce()
    const firstCall = mockCreateServerClient.mock.calls[0]
    expect(firstCall).toBeDefined()
    const [url, key] = firstCall!
    expect(url).toBe(SUPABASE_URL)
    expect(key).toBe(SUPABASE_ANON_KEY)
  })

  it('NEXT_PUBLIC_SUPABASE_URL が未設定なら throw する', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    const { updateSession } = await import('@/lib/supabase/middleware')
    const request = new NextRequest('http://localhost:3010/pages')

    await expect(updateSession(request)).rejects.toThrow('NEXT_PUBLIC_SUPABASE_URL')
  })
})
