---
globs: "proxy.ts, middleware.ts"
---

# Proxy ルール (Next.js 16)

## 概要

`proxy.ts` は Next.js 16 で `middleware.ts` に代わるファイル。Edge Runtime で実行される。
（使用する Next.js バージョンが 15 以前なら `middleware.ts` に同内容を置く）

## 責務

1. **Supabase セッション更新**: `lib/supabase/middleware.ts` の `updateSession()` を毎リクエスト呼ぶ
   （expired token のリフレッシュ。これを省くと Server Component で突然未認証になる）
2. **認証チェック**: 保護ルートへの未認証アクセスを `/login` にリダイレクト
3. **セキュリティヘッダー**: CSP, HSTS, X-Frame-Options
   - CSP の `connect-src` には Supabase ドメインと **AI プロバイダ公式ドメイン**
     （generativelanguage.googleapis.com, api.openai.com, api.anthropic.com）を許可する
     — ブラウザから直接 AI API を呼ぶ設計のため
4. **Origin検証**: Server ActionsのCSRF保護

## 実装パターン

```typescript
import { updateSession } from '@/lib/supabase/middleware'

export default async function proxy(request: NextRequest) {
  // セッション更新は必ず最初（getUser() が走り token がリフレッシュされる）
  const { response, user } = await updateSession(request)

  // 保護ルートへの未認証 → /login にリダイレクト（redirectTo を付与）
  // 認証済みで /login → アプリトップにリダイレクト
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

## 注意

- Edge Runtime制約: Node.js API (`fs`, `crypto` の一部) は使用不可
- ルート定数は `lib/constants/routes.ts` の `PROTECTED_PATHS` を参照（公開ページは PROTECTED_PATHS に含まれない = deny-list 方式）
- `updateSession` 内では `supabase.auth.getUser()` を使う。`getSession()` は cookie を
  検証なしで信用するため、認可判定に使ってはならない
- proxy はリダイレクトのみ。**データの認可は RLS + Server Action 側**が最終防衛線
