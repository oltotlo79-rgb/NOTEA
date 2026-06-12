import { AUTH_PATHS, PROTECTED_PATHS, ROUTES } from '@/lib/constants/routes'

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p)
}

// オープンリダイレクト防止: アプリ内の絶対パスのみ許可（`//host` はプロトコル相対 URL になるため拒否）
export function sanitizeInternalPath(path: string | null): string | null {
  if (!path) return null
  if (!path.startsWith('/') || path.startsWith('//')) return null
  return path
}

export function decideAuthRedirect(pathname: string, isAuthenticated: boolean): string | null {
  if (!isAuthenticated && isProtectedPath(pathname)) {
    return `${ROUTES.LOGIN}?redirectTo=${encodeURIComponent(pathname)}`
  }
  if (isAuthenticated && isAuthPath(pathname)) {
    return ROUTES.PAGES
  }
  return null
}
