import { NextResponse, type NextRequest } from 'next/server'
import { AI_PROVIDER_API_ORIGINS } from '@/lib/constants/security'
import { updateSession } from '@/lib/supabase/middleware'
import { decideAuthRedirect } from '@/lib/utils/auth-redirect'
import { requireEnv } from '@/lib/utils/env'

function buildCsp(nonce: string, supabaseOrigin: string): string {
  const isDev = process.env.NODE_ENV !== 'production'
  // dev は HMR が eval / inline script を使うため緩和。本番は nonce + strict-dynamic
  const scriptSrc = isDev
    ? `'self' 'unsafe-eval' 'unsafe-inline'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`
  const connectSrc = [
    `'self'`,
    supabaseOrigin,
    ...AI_PROVIDER_API_ORIGINS,
    ...(isDev ? ['ws:'] : []),
  ].join(' ')
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${supabaseOrigin}`,
    `font-src 'self'`,
    `connect-src ${connectSrc}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join('; ')
}

export default async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const supabaseOrigin = new URL(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  ).origin
  const csp = buildCsp(nonce, supabaseOrigin)

  // Next.js はリクエストヘッダーの CSP を読んで自身の inline script に nonce を付与する
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const { response, user } = await updateSession(request, requestHeaders)

  const redirectTo = decideAuthRedirect(request.nextUrl.pathname, user !== null)
  let res = response
  if (redirectTo) {
    res = NextResponse.redirect(new URL(redirectTo, request.url))
    // updateSession が積んだリフレッシュ済みセッション cookie をリダイレクト応答へ引き継ぐ
    response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie))
  }

  res.headers.set('Content-Security-Policy', csp)
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
