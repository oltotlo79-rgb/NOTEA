import { describe, expect, it } from 'vitest'
import {
  decideAuthRedirect,
  isAuthPath,
  isProtectedPath,
  sanitizeInternalPath,
} from '@/lib/utils/auth-redirect'

describe('isProtectedPath', () => {
  it.each(['/pages', '/pages/abc', '/settings/ai', '/trash'])('%s は保護対象', (p) => {
    expect(isProtectedPath(p)).toBe(true)
  })
  it.each(['/', '/login', '/help', '/pagesx'])('%s は保護対象外', (p) => {
    expect(isProtectedPath(p)).toBe(false)
  })
})

describe('isAuthPath', () => {
  it('完全一致のみ認証ページ扱い', () => {
    expect(isAuthPath('/login')).toBe(true)
    expect(isAuthPath('/password-reset')).toBe(true)
    // リカバリーセッション中（認証済み）でも表示が必要なため対象外
    expect(isAuthPath('/password-reset/confirm')).toBe(false)
  })
})

describe('sanitizeInternalPath', () => {
  it('内部パスはそのまま返す', () => {
    expect(sanitizeInternalPath('/pages/abc')).toBe('/pages/abc')
  })
  it.each([null, '', 'https://evil.example.com', '//evil.example.com', 'pages'])(
    '%s は null（オープンリダイレクト防止）',
    (p) => {
      expect(sanitizeInternalPath(p)).toBeNull()
    }
  )
})

describe('decideAuthRedirect', () => {
  it('未認証で保護ルート → /login に redirectTo 付きで誘導', () => {
    expect(decideAuthRedirect('/pages/abc', false)).toBe('/login?redirectTo=%2Fpages%2Fabc')
  })
  it('認証済みで認証ページ → /pages へ', () => {
    expect(decideAuthRedirect('/login', true)).toBe('/pages')
  })
  it('それ以外はリダイレクトしない', () => {
    expect(decideAuthRedirect('/', false)).toBeNull()
    expect(decideAuthRedirect('/pages', true)).toBeNull()
    expect(decideAuthRedirect('/', true)).toBeNull()
  })
})
