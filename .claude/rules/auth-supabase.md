---
globs: "lib/supabase/**/*.ts, app/(auth)/**/*.tsx, app/(auth)/**/*.ts, components/auth/**/*.tsx, proxy.ts"
---

# 認証ルール（Supabase Auth）

## 構成ファイル

| ファイル | 役割 |
|---------|------|
| `lib/supabase/server.ts` | サーバー用クライアント生成（`@supabase/ssr` の `createServerClient` + cookies） |
| `lib/supabase/client.ts` | ブラウザ用クライアント生成（`createBrowserClient`） |
| `lib/supabase/middleware.ts` | `updateSession()` — proxy.ts から毎リクエスト呼ぶトークン更新 |
| `app/(auth)/auth/callback/route.ts` | OAuth コールバック（`exchangeCodeForSession`） |
| `lib/actions/utils.ts` | `requireUser()` / `requirePaidUser()` ヘルパー |

## 認証チェックパターン

```typescript
// Server Action / Server Component での認証
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return actionError(ERR_AUTH_REQUIRED)
```

- **必ず `getUser()` を使う。`getSession()` を認可判定に使わない**
  — `getSession()` は cookie の中身を検証せずに返すため偽装可能。
  `getUser()` は Auth サーバーに問い合わせて検証する
- Action では毎回 `requireUser()` を通す（proxy のリダイレクトに頼らない）

## プロバイダー

- **メール + パスワード**: Supabase Auth 標準（確認メール必須設定）
- **Google OAuth**: `signInWithOAuth({ provider: 'google' })` → `auth/callback` で
  `exchangeCodeForSession`

## プロフィール

- Auth の `auth.users` に業務カラムを足さない。`public.profiles` テーブル
  （`id uuid references auth.users`）にプラン種別・表示名を持つ
- ユーザー作成時に `profiles` 行を作る trigger をマイグレーションで定義

## プラン判定

- 有料機能の gate は `requirePaidUser()`（`profiles.plan = 'paid'` を確認）
- Stripe 導入（第2弾）までは `plan` カラムのみ用意し、全員 `free`

## Proxy連携

- `proxy.ts` で `updateSession()` を毎リクエスト実行（トークンリフレッシュ）
- 保護パス: `PROTECTED_PATHS` (lib/constants/routes.ts)
- 認証ページ: ログイン済みはアプリトップにリダイレクト

## 鍵の取り扱い

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` は RLS 前提で公開してよい
- `SUPABASE_SERVICE_ROLE_KEY` は **RLS をバイパスする**。`lib/supabase/admin.ts`
  以外で import しない。`NEXT_PUBLIC_` を付けない。クライアントバンドルに混入させない
