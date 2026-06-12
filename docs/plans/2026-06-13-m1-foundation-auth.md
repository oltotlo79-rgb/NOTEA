# M1: 基盤＋認証 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js + Supabase の土台（雛形・テスト基盤・定数・DB スキーマ＋RLS＋DB 関数・クライアント層・proxy・認証一式・CI）を構築し、メール＋パスワード／Google でログインできる状態にする。

**Architecture:** Server Component デフォルト + Server Action（認証→Zod→制限チェック）+ Supabase RLS の多層防御。DB スキーマは第1弾全量（profiles / pages / ai_usage / Storage）を M1 のマイグレーション 1 本で定義する。認証メールは token_hash 方式（`/auth/confirm` で `verifyOtp`）、OAuth は `/auth/callback` で `exchangeCodeForSession`。

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript strict + noUncheckedIndexedAccess / Tailwind CSS 4 / shadcn/ui / Supabase (@supabase/ssr) / Zod 4 / Vitest + RTL / Playwright

**実行環境メモ（Windows）:**
- シェルコマンドは Git Bash 構文で記載。型生成のリダイレクト（`>`）は PowerShell だと UTF-16 になるため **必ず Git Bash で実行**
- コミットメッセージ末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` を付与

---

## ファイル構成（M1 で作成・変更するもの）

```
proxy.ts                          # セッション更新+認証リダイレクト+セキュリティヘッダー
types/action-result.ts            # ActionResult<T> + actionSuccess/actionError
types/database.ts                 # Supabase 生成型（自動生成）
lib/constants/errors.ts           # エラーメッセージ定数
lib/constants/routes.ts           # ルート定数 + PROTECTED_PATHS / AUTH_PATHS
lib/constants/security.ts         # AI プロバイダ公式オリジン allowlist（CSP と M4 proxy で共用）
lib/constants/limits/pages.ts     # ページ系制限値
lib/constants/limits/ai.ts        # AI 系制限値 + AiProvider 型
lib/constants/limits/images.ts    # 画像系制限値
lib/constants/limits/index.ts     # barrel
lib/utils/env.ts                  # requireEnv（環境変数の存在保証）
lib/utils/auth-redirect.ts        # 認証リダイレクト判定の純関数群
lib/validations/auth.ts           # 認証系 Zod スキーマ
lib/supabase/server.ts            # Server Component / Action 用クライアント
lib/supabase/client.ts            # ブラウザ用クライアント
lib/supabase/middleware.ts        # updateSession（proxy から呼ぶ）
lib/supabase/admin.ts             # service_role（server-only）
lib/actions/utils.ts              # requireUser / requirePaidUser / enforcePlanLimit
lib/actions/auth.ts               # signUp / signIn / signOut / requestPasswordReset / updatePassword
app/(public)/page.tsx             # LP プレースホルダ（M5 で本実装）
app/(auth)/layout.tsx             # 中央寄せレイアウト
app/(auth)/login/page.tsx
app/(auth)/register/page.tsx
app/(auth)/register/verify-email-sent/page.tsx
app/(auth)/password-reset/page.tsx
app/(auth)/password-reset/confirm/page.tsx
app/(auth)/auth/callback/route.ts # OAuth コード交換
app/(auth)/auth/confirm/route.ts  # メール token_hash 検証
app/(main)/layout.tsx             # M2 で 2 カラム化するプレースホルダ
app/(main)/pages/page.tsx         # ログイン後トップ（M2 で本実装）
components/auth/LoginForm.tsx
components/auth/RegisterForm.tsx
components/auth/PasswordResetRequestForm.tsx
components/auth/PasswordResetConfirmForm.tsx
components/auth/GoogleSignInButton.tsx
components/auth/SignOutButton.tsx
supabase/migrations/<ts>_init.sql # 第1弾スキーマ全量（RLS/トリガー/関数/Storage）
supabase/templates/confirmation.html
supabase/templates/recovery.html
supabase/seed.sql                 # E2E 用テストユーザー
vitest.config.ts / playwright.config.ts
__tests__/setup.ts
__tests__/utils/test-utils.tsx    # createMockSupabaseClient
__tests__/types/action-result.test.ts
__tests__/lib/constants/errors.test.ts
__tests__/lib/utils/env.test.ts
__tests__/lib/utils/auth-redirect.test.ts
__tests__/lib/validations/auth.test.ts
__tests__/lib/actions/utils.test.ts
__tests__/lib/actions/auth.test.ts
e2e/helpers/navigation.ts
e2e/auth.spec.ts
.github/workflows/ci.yml
.env.local / .env.local.example
```

---

### Task 1: Git 初期化と Next.js 雛形

**Files:**
- Create: Next.js 雛形一式（`package.json`, `tsconfig.json`, `app/`, ほか）
- Modify: `tsconfig.json`（noUncheckedIndexedAccess 追加）

- [ ] **Step 1: git init**

```bash
cd /c/Users/oltot/Documents/git-projects/Notea
git init -b master
git add -A && git commit -m "docs: 要件定義書・ロードマップ・開発規約を追加"
```

- [ ] **Step 2: create-next-app（一時ディレクトリ → 移動）**

ルートに CLAUDE.md 等があると create-next-app が拒否するため、一時ディレクトリで生成して移動する:

```bash
npx create-next-app@latest .notea-scaffold --ts --eslint --tailwind --app --no-src-dir --import-alias "@/*" --skip-install --yes
# 生成物をルートへ移動（隠しファイル含む）
mv .notea-scaffold/* .notea-scaffold/.* . 2>/dev/null || true
rmdir .notea-scaffold
npm install
```

期待: `package.json` に next 16.x / react 19.x / tailwindcss 4.x

- [ ] **Step 3: tsconfig.json に noUncheckedIndexedAccess を追加**

`compilerOptions` に `"noUncheckedIndexedAccess": true` を追記（`strict: true` は雛形デフォルトで有効なことを確認）。

- [ ] **Step 4: 動作確認**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

期待: すべて成功

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: Next.js 雛形を作成（TS strict + noUncheckedIndexedAccess + Tailwind 4）"
```

---

### Task 2: 依存ライブラリと shadcn/ui

**Files:**
- Modify: `package.json`
- Create: `components.json`, `components/ui/*`, `lib/utils.ts`（shadcn 生成）

- [ ] **Step 1: 依存追加**

```bash
npm i @supabase/supabase-js @supabase/ssr zod @tanstack/react-query server-only
npm i -D vitest @vitejs/plugin-react @vitest/coverage-istanbul jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

- [ ] **Step 2: shadcn/ui 初期化とコンポーネント追加**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input label card
```

- [ ] **Step 3: ビルド確認 + Commit**

```bash
npm run build
git add -A && git commit -m "chore: Supabase/Zod/React Query/テスト系/shadcn-ui を導入"
```

---

### Task 3: テスト基盤（Vitest / Playwright / scripts）

**Files:**
- Create: `vitest.config.ts`, `__tests__/setup.ts`, `playwright.config.ts`, `e2e/helpers/navigation.ts`
- Modify: `package.json`（scripts）

- [ ] **Step 1: vitest.config.ts**

```typescript
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'istanbul',
      include: ['lib/**', 'types/**', 'components/**', 'hooks/**'],
      exclude: ['components/ui/**', 'types/database.ts'],
      thresholds: { branches: 80, functions: 85, lines: 85, statements: 85 },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

（`components/ui/**` は shadcn 生成物、`types/database.ts` は自動生成のため対象外）

- [ ] **Step 2: __tests__/setup.ts**

```typescript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```

- [ ] **Step 4: e2e/helpers/navigation.ts**

```typescript
import type { Locator, Page } from '@playwright/test'

// click → waitForURL を順に書くと navigation 完了を取り逃がして flake するため atomic に待つ
export async function clickAndWaitForUrl(page: Page, locator: Locator, url: string | RegExp) {
  await Promise.all([page.waitForURL(url), locator.click()])
}
```

- [ ] **Step 5: package.json に scripts 追加**

```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:e2e": "playwright test",
"test:all": "npm run test && npm run test:e2e"
```

- [ ] **Step 6: 動作確認 + Commit**

```bash
npx playwright install chromium
npm test   # テスト 0 件でも構成エラーが無いこと（passWithNoTests が必要なら vitest.config.ts に追加）
git add -A && git commit -m "chore: Vitest/Playwright テスト基盤を構築"
```

---

### Task 4: 基盤型・定数（TDD）

**Files:**
- Create: `types/action-result.ts`, `lib/constants/errors.ts`, `lib/constants/routes.ts`, `lib/constants/security.ts`, `lib/constants/limits/{pages,ai,images,index}.ts`
- Test: `__tests__/types/action-result.test.ts`, `__tests__/lib/constants/errors.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/types/action-result.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { actionError, actionSuccess } from '@/types/action-result'

describe('ActionResult', () => {
  it('actionSuccess はデータ付き成功を返す', () => {
    expect(actionSuccess({ id: '1' })).toEqual({ success: true, data: { id: '1' } })
  })
  it('actionSuccess はデータ無しでも成功を返す', () => {
    expect(actionSuccess()).toEqual({ success: true, data: undefined })
  })
  it('actionError はエラーメッセージを返す', () => {
    expect(actionError('NG')).toEqual({ success: false, error: 'NG' })
  })
})
```

`__tests__/lib/constants/errors.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { ERR_PAGE_LIMIT_REACHED } from '@/lib/constants/errors'

describe('errors', () => {
  it('ERR_PAGE_LIMIT_REACHED は上限値を埋め込む', () => {
    expect(ERR_PAGE_LIMIT_REACHED(100)).toContain('100')
  })
})
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
npm test
```

期待: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`types/action-result.ts`:

```typescript
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

export function actionSuccess<T = void>(data?: T): ActionResult<T> {
  return { success: true, data }
}

export function actionError<T = void>(error: string): ActionResult<T> {
  return { success: false, error }
}
```

`lib/constants/errors.ts`:

```typescript
export const ERR_AUTH_REQUIRED = 'ログインが必要です'
export const ERR_INVALID_INPUT = '入力内容が正しくありません'
export const ERR_DB = 'データの読み書きに失敗しました。時間をおいて再試行してください'
export const ERR_PAID_REQUIRED = 'この機能は有料プランでのみ利用できます'
export const ERR_LOGIN_FAILED = 'メールアドレスまたはパスワードが正しくありません'
export const ERR_SIGNUP_FAILED = 'アカウント登録に失敗しました。時間をおいて再試行してください'
export const ERR_PASSWORD_UPDATE_FAILED =
  'パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります'
export const ERR_PAGE_LIMIT_REACHED = (max: number) =>
  `ページ数の上限（${max}ページ）に達しました。不要なページを削除するか、プレミアムプランをご検討ください`
```

`lib/constants/routes.ts`:

```typescript
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL_SENT: '/register/verify-email-sent',
  PASSWORD_RESET: '/password-reset',
  PASSWORD_RESET_CONFIRM: '/password-reset/confirm',
  AUTH_CALLBACK: '/auth/callback',
  AUTH_CONFIRM: '/auth/confirm',
  PAGES: '/pages',
  TRASH: '/trash',
  SETTINGS: '/settings',
} as const

export const PROTECTED_PATHS: readonly string[] = [ROUTES.PAGES, ROUTES.SETTINGS, ROUTES.TRASH]

// 完全一致で判定する（/password-reset/confirm はリカバリーセッション中＝認証済みでも
// 表示する必要があるため、prefix 一致にしない）
export const AUTH_PATHS: readonly string[] = [ROUTES.LOGIN, ROUTES.REGISTER, ROUTES.PASSWORD_RESET]
```

`lib/constants/security.ts`:

```typescript
// CSP connect-src と AI パススルー（M4）の転送先 allowlist で共用する。
// ここに無いオリジンへ鍵が送られない構造を CSP 自体が保証する（BYOK の防衛線）
export const AI_PROVIDER_API_ORIGINS: readonly string[] = [
  'https://generativelanguage.googleapis.com',
  'https://api.openai.com',
  'https://api.anthropic.com',
]
```

`lib/constants/limits/pages.ts`:

```typescript
export const FREE_MAX_PAGES = 100
export const MAX_PAGE_TITLE_LENGTH = 200
export const MAX_PAGE_CONTENT_BYTES = 1024 * 1024
export const MAX_PAGE_DEPTH = 10
export const TRASH_RETENTION_DAYS = 30
```

`lib/constants/limits/ai.ts`:

```typescript
export const AI_PROVIDERS = ['gemini', 'openai', 'anthropic'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export const FREE_AI_PROVIDERS: readonly AiProvider[] = ['gemini']
export const FREE_AI_DAILY_LIMIT = 5
export const PAID_AI_DAILY_LIMIT = 100
```

`lib/constants/limits/images.ts`:

```typescript
export const MAX_IMAGE_INPUT_SIZE_MB = 20
export const MAX_IMAGE_STORED_SIZE_MB = 5
export const IMAGE_MAX_DIMENSION = 2048
export const IMAGE_WEBP_QUALITY = 80
export const FREE_MAX_STORAGE_MB = 200
export const PAID_MAX_STORAGE_GB = 5
```

`lib/constants/limits/index.ts`:

```typescript
export * from './pages'
export * from './ai'
export * from './images'
```

- [ ] **Step 4: テスト実行 → 成功を確認**

```bash
npm test
```

期待: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: ActionResult 型とエラー/ルート/制限値定数を追加"
```

---

### Task 5: Supabase ローカル環境とマイグレーション

**Files:**
- Create: `supabase/config.toml`（init 後編集）, `supabase/migrations/<ts>_init.sql`, `supabase/templates/confirmation.html`, `supabase/templates/recovery.html`, `supabase/seed.sql`, `types/database.ts`（生成）, `.env.local`, `.env.local.example`

- [ ] **Step 1: supabase init**

```bash
npx supabase init
```

- [ ] **Step 2: config.toml を編集**

以下のキーを変更・追記（他は生成デフォルトのまま）:

```toml
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/**"]

[auth.email]
enable_signup = true
enable_confirmations = true

[auth.email.template.confirmation]
subject = "【Notea】メールアドレスの確認"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "【Notea】パスワード再設定"
content_path = "./supabase/templates/recovery.html"
```

- [ ] **Step 3: メールテンプレート作成**

`supabase/templates/confirmation.html`:

```html
<h2>メールアドレスの確認</h2>
<p>以下のリンクをクリックして Notea の登録を完了してください。</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/pages">メールアドレスを確認する</a></p>
<p>このメールに心当たりがない場合は破棄してください。</p>
```

`supabase/templates/recovery.html`:

```html
<h2>パスワード再設定</h2>
<p>以下のリンクから新しいパスワードを設定してください。</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/password-reset/confirm">パスワードを再設定する</a></p>
<p>このメールに心当たりがない場合は破棄してください。</p>
```

（本番リリース時は同内容を Supabase Dashboard の Email Templates に設定する — M5 のデプロイ手順に含める）

- [ ] **Step 4: マイグレーション作成**

```bash
npx supabase migration new init
```

生成された `supabase/migrations/<timestamp>_init.sql` に以下を記述:

```sql
-- =============================================
-- Notea 第1弾スキーマ全量（profiles / pages / ai_usage / Storage / 関数）
-- 制限値の対応: 深さ10 = MAX_PAGE_DEPTH, 5242880 = MAX_IMAGE_STORED_SIZE_MB 相当
-- =============================================

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles -----------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) <= 50),
  plan text not null default 'free' check (plan in ('free', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "owner_select" on public.profiles for select using (auth.uid() = id);
create policy "owner_update" on public.profiles for update using (auth.uid() = id);
-- insert はトリガー（security definer）経由のみ / delete は auth.users の cascade

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'ユーザー'), 50)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- pages --------------------------------------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.pages(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  icon text,
  content jsonb not null default '[]',
  content_text text not null default '',
  sort_order double precision not null default 0,
  is_trashed boolean not null default false,
  trashed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pages enable row level security;

create policy "owner_select" on public.pages for select using (auth.uid() = user_id);
create policy "owner_insert" on public.pages for insert with check (auth.uid() = user_id);
create policy "owner_update" on public.pages for update using (auth.uid() = user_id);
create policy "owner_delete" on public.pages for delete using (auth.uid() = user_id);

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

create index pages_tree_idx on public.pages (user_id, is_trashed, parent_id, sort_order);
create index pages_recent_idx on public.pages (user_id, is_trashed, updated_at desc, id desc);
create index pages_trash_cleanup_idx on public.pages (is_trashed, trashed_at);

-- ai_usage -----------------------------------------------------------------
-- 鍵・プロンプト・応答に関するカラムは設計として持たない（BYOK）
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null,
  provider text not null check (provider in ('gemini', 'openai', 'anthropic')),
  count integer not null default 0,
  unique (user_id, used_on, provider)
);

alter table public.ai_usage enable row level security;

create policy "owner_select" on public.ai_usage for select using (auth.uid() = user_id);
-- 書き込みポリシーなし（consume_ai_usage 関数経由のみ）

-- 関数 -----------------------------------------------------------------------

-- ごみ箱を除く自分のページ数（ページ作成の上限チェック用）
create or replace function public.count_user_pages()
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.pages
  where user_id = auth.uid() and is_trashed = false;
$$;

-- AI 回数のアトミック消費。上限内なら increment して新しい count を返し、超過なら例外
create or replace function public.consume_ai_usage(p_provider text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_count integer;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_provider not in ('gemini', 'openai', 'anthropic') then
    raise exception 'INVALID_PROVIDER';
  end if;

  insert into public.ai_usage (user_id, used_on, provider, count)
  values (v_user, v_today, p_provider, 1)
  on conflict (user_id, used_on, provider)
  do update set count = ai_usage.count + 1
  where ai_usage.count < p_limit
  returning count into v_count;

  if v_count is null then
    raise exception 'AI_LIMIT_EXCEEDED';
  end if;
  return v_count;
end;
$$;

-- ページ移動（循環参照チェック + 深さ上限チェック + 移動をアトミックに実行）
-- security invoker のため RLS が適用される（他人のページは見えない＝動かせない）
create or replace function public.move_page(p_page_id uuid, p_new_parent_id uuid)
returns void
language plpgsql
as $$
declare
  v_parent_depth integer := 0;
  v_subtree_height integer;
begin
  if not exists (select 1 from public.pages where id = p_page_id) then
    raise exception 'PAGE_NOT_FOUND';
  end if;

  if p_new_parent_id is not null then
    if p_new_parent_id = p_page_id then
      raise exception 'CIRCULAR_REFERENCE';
    end if;
    if not exists (select 1 from public.pages where id = p_new_parent_id) then
      raise exception 'PAGE_NOT_FOUND';
    end if;

    if exists (
      with recursive descendants as (
        select id from public.pages where parent_id = p_page_id
        union all
        select p.id from public.pages p join descendants d on p.parent_id = d.id
      )
      select 1 from descendants where id = p_new_parent_id
    ) then
      raise exception 'CIRCULAR_REFERENCE';
    end if;

    with recursive ancestors as (
      select id, parent_id, 1 as depth from public.pages where id = p_new_parent_id
      union all
      select p.id, p.parent_id, a.depth + 1
      from public.pages p join ancestors a on p.id = a.parent_id
    )
    select max(depth) into v_parent_depth from ancestors;
  end if;

  with recursive subtree as (
    select id, 1 as height from public.pages where id = p_page_id
    union all
    select p.id, s.height + 1 from public.pages p join subtree s on p.parent_id = s.id
  )
  select max(height) into v_subtree_height from subtree;

  if v_parent_depth + v_subtree_height > 10 then
    raise exception 'DEPTH_LIMIT_EXCEEDED';
  end if;

  update public.pages set parent_id = p_new_parent_id where id = p_page_id;
end;
$$;

-- Storage ------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('page-images', 'page-images', false, 5242880, array['image/webp']);

create policy "page_images_owner_select" on storage.objects for select
  using (bucket_id = 'page-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "page_images_owner_insert" on storage.objects for insert
  with check (bucket_id = 'page-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "page_images_owner_update" on storage.objects for update
  using (bucket_id = 'page-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "page_images_owner_delete" on storage.objects for delete
  using (bucket_id = 'page-images' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 5: seed.sql（E2E 用テストユーザー）**

`supabase/seed.sql`:

```sql
-- E2E テスト用ユーザー（ローカル/CI の db reset でのみ投入される。本番には適用されない）
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'e2e@example.com',
  crypt('Password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now()
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  jsonb_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'email', 'e2e@example.com',
    'email_verified', true
  ),
  'email', now(), now(), now()
);
```

- [ ] **Step 6: 起動・適用・型生成（Git Bash で実行）**

```bash
npx supabase start
npx supabase db reset
npx supabase gen types typescript --local > types/database.ts
```

期待: reset 成功（トリガー・関数・バケット込み）、`types/database.ts` に profiles/pages/ai_usage と関数型が生成される

- [ ] **Step 7: .env.local / .env.local.example**

`supabase start` の出力（`npx supabase status`）から値を取得:

```bash
# .env.local.example（コミットする）
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<supabase status の anon key>"
SUPABASE_SERVICE_ROLE_KEY="<supabase status の service_role key>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CRON_SECRET="local-dev-secret"
```

`.env.local` に実値を設定（雛形の .gitignore で除外済みであること、`.env.local.example` は除外されないことを確認。除外される場合は `!.env.local.example` を追記）。

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: Supabase スキーマ全量（RLS/トリガー/DB関数/Storage）とローカル環境を構築"
```

---

### Task 6: 環境変数ユーティリティと Supabase クライアント 4 種（TDD）

**Files:**
- Create: `lib/utils/env.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`, `lib/supabase/admin.ts`
- Test: `__tests__/lib/utils/env.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/lib/utils/env.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { requireEnv } from '@/lib/utils/env'

describe('requireEnv', () => {
  it('値があればそのまま返す', () => {
    expect(requireEnv('value', 'KEY')).toBe('value')
  })
  it('undefined なら変数名入りで throw する', () => {
    expect(() => requireEnv(undefined, 'MY_KEY')).toThrow('MY_KEY')
  })
  it('空文字なら throw する', () => {
    expect(() => requireEnv('', 'MY_KEY')).toThrow('MY_KEY')
  })
})
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
npm test
```

- [ ] **Step 3: 実装**

`lib/utils/env.ts`:

```typescript
// NEXT_PUBLIC_* はビルド時インライン置換されるため process.env.X のリテラル参照を
// 呼び出し側に残し、値だけを受け取って存在を保証する
export function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}
```

`lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireEnv } from '@/lib/utils/env'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Server Component からは cookie を書けない（セッション更新は proxy が担う）
          }
        },
      },
    }
  )
}
```

`lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import { requireEnv } from '@/lib/utils/env'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
}
```

`lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { requireEnv } from '@/lib/utils/env'
import type { Database } from '@/types/database'

export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request: { headers: requestHeaders ?? request.headers } })

  const supabase = createServerClient<Database>(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: requestHeaders ?? request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // getSession() は cookie を検証せず信用するため認可判定に使わない
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
```

`lib/supabase/admin.ts`:

```typescript
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/utils/env'
import type { Database } from '@/types/database'

// RLS をバイパスする。webhook / cron / アカウント削除などユーザーセッションが無い処理専用
export function createAdminClient() {
  return createSupabaseClient<Database>(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 4: テスト・型チェック → 成功確認**

```bash
npm test && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Supabase クライアント層（server/client/middleware/admin）を実装"
```

---

### Task 7: 認証リダイレクト判定と proxy.ts（TDD）

**Files:**
- Create: `lib/utils/auth-redirect.ts`, `proxy.ts`
- Test: `__tests__/lib/utils/auth-redirect.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/lib/utils/auth-redirect.test.ts`:

```typescript
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
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
npm test
```

- [ ] **Step 3: 実装**

`lib/utils/auth-redirect.ts`:

```typescript
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
```

`proxy.ts`（プロジェクトルート）:

```typescript
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

  // Next.js はリクエストヘッダーの CSP nonce を読んで自身の inline script に付与する
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
```

- [ ] **Step 4: テスト・型チェック → 成功確認**

```bash
npm test && npm run typecheck
```

- [ ] **Step 5: 手動確認**

```bash
npm run dev
# 別ターミナル: 未認証で /pages → /login?redirectTo=%2Fpages に 307
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3000/pages
```

期待: `307 http://localhost:3000/login?redirectTo=%2Fpages`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: proxy.ts（セッション更新・認証リダイレクト・CSP/セキュリティヘッダー）を実装"
```

---

### Task 8: 認証バリデーション（TDD）

**Files:**
- Create: `lib/validations/auth.ts`
- Test: `__tests__/lib/validations/auth.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/lib/validations/auth.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { passwordSchema, signInSchema, signUpSchema } from '@/lib/validations/auth'

describe('passwordSchema', () => {
  it('8文字以上・英字と数字を含むパスワードを受理', () => {
    expect(passwordSchema.safeParse('abcde123').success).toBe(true)
  })
  it.each([
    ['abc12', '8文字未満'],
    ['abcdefgh', '数字なし'],
    ['12345678', '英字なし'],
  ])('%s を拒否（%s）', (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false)
  })
})

describe('signUpSchema', () => {
  it('正しい入力を受理', () => {
    expect(signUpSchema.safeParse({ email: 'a@example.com', password: 'abcde123' }).success).toBe(true)
  })
  it('不正なメールを拒否', () => {
    expect(signUpSchema.safeParse({ email: 'not-an-email', password: 'abcde123' }).success).toBe(false)
  })
})

describe('signInSchema', () => {
  it('ログインはパスワードポリシーを適用しない（既存ユーザーの救済）', () => {
    expect(signInSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true)
  })
  it('空パスワードは拒否', () => {
    expect(signInSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
npm test
```

- [ ] **Step 3: 実装**

`lib/validations/auth.ts`:

```typescript
import { z } from 'zod'

export const emailSchema = z.email({ error: 'メールアドレスの形式が正しくありません' }).max(255)

export const passwordSchema = z
  .string()
  .min(8, 'パスワードは8文字以上で入力してください')
  .regex(/[A-Za-z]/, 'パスワードにはアルファベットを1文字以上含めてください')
  .regex(/[0-9]/, 'パスワードには数字を1文字以上含めてください')

export const signUpSchema = z.object({ email: emailSchema, password: passwordSchema })
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1) })
export const passwordResetRequestSchema = z.object({ email: emailSchema })
export const passwordUpdateSchema = z.object({ password: passwordSchema })
```

- [ ] **Step 4: テスト実行 → 成功確認 + Commit**

```bash
npm test
git add -A && git commit -m "feat: 認証系 Zod スキーマ（パスワードポリシー含む）を追加"
```

---

### Task 9: テストユーティリティと lib/actions/utils.ts（TDD）

**Files:**
- Create: `__tests__/utils/test-utils.tsx`, `lib/actions/utils.ts`
- Test: `__tests__/lib/actions/utils.test.ts`

- [ ] **Step 1: モック Supabase クライアントを作る**

`__tests__/utils/test-utils.tsx`:

```typescript
import { vi } from 'vitest'

type DbResult = { data: unknown; error: { message: string } | null }

export type MockSupabaseOptions = {
  user?: { id: string; email?: string } | null
  queryResult?: DbResult
  rpcResult?: DbResult
  authResult?: { error: { message: string } | null }
}

// from().select()...single()/maybeSingle() のチェーンと auth/rpc を持つ最小モック。
// メソッドは全て vi.fn なので呼び出し検証にも使える
export function createMockSupabaseClient(options: MockSupabaseOptions = {}) {
  const {
    user = { id: 'user-1', email: 'user@example.com' },
    queryResult = { data: null, error: null },
    rpcResult = { data: null, error: null },
    authResult = { error: null },
  } = options

  const builder: Record<string, unknown> = {}
  const chainMethods = ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order', 'limit', 'lt'] as const
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder)
  }
  builder.single = vi.fn(async () => queryResult)
  builder.maybeSingle = vi.fn(async () => queryResult)

  return {
    from: vi.fn(() => builder),
    rpc: vi.fn(async () => rpcResult),
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
      signUp: vi.fn(async () => authResult),
      signInWithPassword: vi.fn(async () => authResult),
      signOut: vi.fn(async () => authResult),
      resetPasswordForEmail: vi.fn(async () => authResult),
      updateUser: vi.fn(async () => authResult),
    },
    _builder: builder,
  }
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>
```

- [ ] **Step 2: 失敗するテストを書く**

`__tests__/lib/actions/utils.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))

const { requireUser, requirePaidUser, enforcePlanLimit } = await import('@/lib/actions/utils')

beforeEach(() => {
  mockClient = createMockSupabaseClient()
})

describe('requireUser', () => {
  it('認証済みなら userId を返す', async () => {
    expect(await requireUser()).toEqual({ userId: 'user-1' })
  })
  it('未認証なら error を返す', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await requireUser()
    expect('error' in result).toBe(true)
  })
})

describe('requirePaidUser', () => {
  it('有料プランなら userId を返す', async () => {
    mockClient = createMockSupabaseClient({ queryResult: { data: { plan: 'paid' }, error: null } })
    expect(await requirePaidUser()).toEqual({ userId: 'user-1' })
  })
  it('無料プランなら error を返す', async () => {
    mockClient = createMockSupabaseClient({ queryResult: { data: { plan: 'free' }, error: null } })
    const result = await requirePaidUser()
    expect('error' in result).toBe(true)
  })
})

describe('enforcePlanLimit', () => {
  it('無料プランで上限未満なら null（許可）', async () => {
    mockClient = createMockSupabaseClient({
      queryResult: { data: { plan: 'free' }, error: null },
      rpcResult: { data: 99, error: null },
    })
    expect(await enforcePlanLimit('user-1', 'create_page')).toBeNull()
  })
  it('無料プランで上限到達なら error', async () => {
    mockClient = createMockSupabaseClient({
      queryResult: { data: { plan: 'free' }, error: null },
      rpcResult: { data: 100, error: null },
    })
    const result = await enforcePlanLimit('user-1', 'create_page')
    expect(result?.error).toContain('100')
  })
  it('有料プランなら常に null', async () => {
    mockClient = createMockSupabaseClient({ queryResult: { data: { plan: 'paid' }, error: null } })
    expect(await enforcePlanLimit('user-1', 'create_page')).toBeNull()
  })
  it('カウント取得失敗なら error（fail-closed）', async () => {
    mockClient = createMockSupabaseClient({
      queryResult: { data: { plan: 'free' }, error: null },
      rpcResult: { data: null, error: { message: 'db error' } },
    })
    expect(await enforcePlanLimit('user-1', 'create_page')).not.toBeNull()
  })
})
```

- [ ] **Step 3: テスト実行 → 失敗確認**

```bash
npm test
```

- [ ] **Step 4: 実装**

`lib/actions/utils.ts`:

```typescript
import { ERR_AUTH_REQUIRED, ERR_DB, ERR_PAGE_LIMIT_REACHED, ERR_PAID_REQUIRED } from '@/lib/constants/errors'
import { FREE_MAX_PAGES } from '@/lib/constants/limits'
import { createClient } from '@/lib/supabase/server'

export type AuthResult = { userId: string } | { error: string }
export type LimitAction = 'create_page'

export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: ERR_AUTH_REQUIRED }
  return { userId: user.id }
}

async function getUserPlan(userId: string): Promise<'free' | 'paid'> {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('plan').eq('id', userId).maybeSingle()
  return data?.plan === 'paid' ? 'paid' : 'free'
}

export async function requirePaidUser(): Promise<AuthResult> {
  const auth = await requireUser()
  if ('error' in auth) return auth
  const plan = await getUserPlan(auth.userId)
  if (plan !== 'paid') return { error: ERR_PAID_REQUIRED }
  return auth
}

export async function enforcePlanLimit(
  userId: string,
  action: LimitAction
): Promise<{ error: string } | null> {
  if (action !== 'create_page') return null
  const plan = await getUserPlan(userId)
  if (plan === 'paid') return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('count_user_pages')
  if (error || data === null) return { error: ERR_DB }
  if (data >= FREE_MAX_PAGES) return { error: ERR_PAGE_LIMIT_REACHED(FREE_MAX_PAGES) }
  return null
}
```

- [ ] **Step 5: テスト実行 → 成功確認 + Commit**

```bash
npm test && npm run typecheck
git add -A && git commit -m "feat: Server Action 共通ヘルパー（requireUser/requirePaidUser/enforcePlanLimit）を実装"
```

---

### Task 10: 認証 Server Actions（TDD）

**Files:**
- Create: `lib/actions/auth.ts`
- Test: `__tests__/lib/actions/auth.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/lib/actions/auth.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mockClient,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { signUp, signIn, signOut, requestPasswordReset, updatePassword } = await import(
  '@/lib/actions/auth'
)

beforeEach(() => {
  mockClient = createMockSupabaseClient()
})

describe('signUp', () => {
  it('正しい入力で成功する', async () => {
    const result = await signUp({ email: 'a@example.com', password: 'abcde123' })
    expect(result.success).toBe(true)
    expect(mockClient.auth.signUp).toHaveBeenCalledWith({
      email: 'a@example.com',
      password: 'abcde123',
    })
  })
  it('ポリシー違反パスワードは Zod で拒否し signUp を呼ばない', async () => {
    const result = await signUp({ email: 'a@example.com', password: 'short' })
    expect(result.success).toBe(false)
    expect(mockClient.auth.signUp).not.toHaveBeenCalled()
  })
  it('Supabase エラー時は失敗を返す', async () => {
    mockClient = createMockSupabaseClient({ authResult: { error: { message: 'boom' } } })
    const result = await signUp({ email: 'a@example.com', password: 'abcde123' })
    expect(result.success).toBe(false)
  })
})

describe('signIn', () => {
  it('正しい入力で成功する', async () => {
    const result = await signIn({ email: 'a@example.com', password: 'x' })
    expect(result.success).toBe(true)
  })
  it('認証失敗時は汎用メッセージを返す（情報を漏らさない）', async () => {
    mockClient = createMockSupabaseClient({ authResult: { error: { message: 'Invalid login' } } })
    const result = await signIn({ email: 'a@example.com', password: 'wrong1234' })
    expect(result).toEqual({ success: false, error: expect.stringContaining('正しくありません') })
  })
  it('不正な入力は Zod で拒否', async () => {
    const result = await signIn({ email: 'bad', password: '' })
    expect(result.success).toBe(false)
    expect(mockClient.auth.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe('signOut', () => {
  it('signOut を呼び成功を返す', async () => {
    const result = await signOut()
    expect(result.success).toBe(true)
    expect(mockClient.auth.signOut).toHaveBeenCalled()
  })
})

describe('requestPasswordReset', () => {
  it('成功時もエラー時も成功を返す（メール存在の有無を漏らさない）', async () => {
    expect((await requestPasswordReset({ email: 'a@example.com' })).success).toBe(true)
    mockClient = createMockSupabaseClient({ authResult: { error: { message: 'not found' } } })
    expect((await requestPasswordReset({ email: 'a@example.com' })).success).toBe(true)
  })
  it('不正なメールは拒否', async () => {
    expect((await requestPasswordReset({ email: 'bad' })).success).toBe(false)
  })
})

describe('updatePassword', () => {
  it('リカバリーセッションがあれば更新できる', async () => {
    const result = await updatePassword({ password: 'newpass123' })
    expect(result.success).toBe(true)
    expect(mockClient.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' })
  })
  it('未認証なら失敗', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    expect((await updatePassword({ password: 'newpass123' })).success).toBe(false)
  })
  it('ポリシー違反は拒否', async () => {
    expect((await updatePassword({ password: 'short' })).success).toBe(false)
  })
})
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
npm test
```

- [ ] **Step 3: 実装**

`lib/actions/auth.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import {
  ERR_AUTH_REQUIRED,
  ERR_INVALID_INPUT,
  ERR_LOGIN_FAILED,
  ERR_PASSWORD_UPDATE_FAILED,
  ERR_SIGNUP_FAILED,
} from '@/lib/constants/errors'
import { createClient } from '@/lib/supabase/server'
import {
  passwordResetRequestSchema,
  passwordUpdateSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validations/auth'
import { actionError, actionSuccess, type ActionResult } from '@/types/action-result'

export async function signUp(input: { email: string; password: string }): Promise<ActionResult> {
  // 1. 認証 — 不要（未認証ユーザーの操作）
  // 2. Zod バリデーション
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  // 4. ビジネスロジック（確認メールのリンク先は Supabase のメールテンプレート側で指定）
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp(parsed.data)
  if (error) return actionError(ERR_SIGNUP_FAILED)
  return actionSuccess()
}

export async function signIn(input: { email: string; password: string }): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return actionError(ERR_LOGIN_FAILED)
  revalidatePath('/', 'layout')
  return actionSuccess()
}

export async function signOut(): Promise<ActionResult> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return actionSuccess()
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = passwordResetRequestSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const supabase = await createClient()
  // メールアドレスの存在有無を漏らさないため、結果に関わらず成功を返す
  await supabase.auth.resetPasswordForEmail(parsed.data.email)
  return actionSuccess()
}

export async function updatePassword(input: { password: string }): Promise<ActionResult> {
  const parsed = passwordUpdateSchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return actionError(ERR_AUTH_REQUIRED)
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return actionError(ERR_PASSWORD_UPDATE_FAILED)
  revalidatePath('/', 'layout')
  return actionSuccess()
}
```

- [ ] **Step 4: テスト実行 → 成功確認 + Commit**

```bash
npm test && npm run typecheck
git add -A && git commit -m "feat: 認証 Server Actions（登録/ログイン/ログアウト/パスワードリセット）を実装"
```

---

### Task 11: 認証ルートハンドラ（callback / confirm）

**Files:**
- Create: `app/(auth)/auth/callback/route.ts`, `app/(auth)/auth/confirm/route.ts`

- [ ] **Step 1: OAuth コールバック実装**

`app/(auth)/auth/callback/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { ROUTES } from '@/lib/constants/routes'
import { createClient } from '@/lib/supabase/server'
import { sanitizeInternalPath } from '@/lib/utils/auth-redirect'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = sanitizeInternalPath(searchParams.get('next')) ?? ROUTES.PAGES

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}${ROUTES.LOGIN}?error=auth_callback`)
}
```

- [ ] **Step 2: メール token_hash 検証実装**

`app/(auth)/auth/confirm/route.ts`:

```typescript
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { ROUTES } from '@/lib/constants/routes'
import { createClient } from '@/lib/supabase/server'
import { sanitizeInternalPath } from '@/lib/utils/auth-redirect'

const VALID_OTP_TYPES = ['signup', 'recovery', 'email', 'email_change'] as const

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return VALID_OTP_TYPES.some((t) => t === value)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = sanitizeInternalPath(searchParams.get('next')) ?? ROUTES.PAGES

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}${ROUTES.LOGIN}?error=auth_confirm`)
}
```

- [ ] **Step 3: 型チェック + Commit**

```bash
npm run typecheck
git add -A && git commit -m "feat: 認証ルートハンドラ（OAuth callback / メール confirm）を実装"
```

---

### Task 12: 認証 UI とアプリ枠

**Files:**
- Create: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/register/verify-email-sent/page.tsx`, `app/(auth)/password-reset/page.tsx`, `app/(auth)/password-reset/confirm/page.tsx`, `app/(main)/layout.tsx`, `app/(main)/pages/page.tsx`, `app/(public)/page.tsx`, `components/auth/*.tsx`
- Delete: `app/page.tsx`（`app/(public)/page.tsx` へ移設）

- [ ] **Step 1: ルートページを (public) へ移設**

`app/page.tsx` を削除し、`app/(public)/page.tsx` を作成:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Notea</h1>
      <p className="max-w-md text-muted-foreground">
        Notion 風のメモ・ドキュメントアプリ。AI はあなた自身の API キーで動くから、安心して使えます。
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href={ROUTES.REGISTER}>無料で始める</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.LOGIN}>ログイン</Link>
        </Button>
      </div>
    </main>
  )
}
```

また `app/layout.tsx` の metadata を更新:

```tsx
export const metadata: Metadata = {
  title: 'Notea — Notion 風メモアプリ（BYOK AI）',
  description: 'ブロックエディタでメモを整理。AI はあなた自身の API キーで動きます。',
}
```

（`lang="ja"` に変更し、既定フォント設定は雛形のまま）

- [ ] **Step 2: 認証レイアウト**

`app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">{children}</div>
}
```

- [ ] **Step 3: フォームコンポーネント**

`components/auth/GoogleSignInButton.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'
import { createClient } from '@/lib/supabase/client'

export function GoogleSignInButton() {
  const handleClick = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${ROUTES.AUTH_CALLBACK}?next=${ROUTES.PAGES}`,
      },
    })
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleClick}>
      Google でログイン
    </Button>
  )
}
```

`components/auth/SignOutButton.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/actions/auth'
import { ROUTES } from '@/lib/constants/routes'

export function SignOutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = () =>
    startTransition(async () => {
      await signOut()
      router.push(ROUTES.LOGIN)
      router.refresh()
    })

  return (
    <Button variant="ghost" disabled={isPending} onClick={handleClick}>
      ログアウト
    </Button>
  )
}
```

`components/auth/LoginForm.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn } from '@/lib/actions/auth'
import { ROUTES } from '@/lib/constants/routes'
import { sanitizeInternalPath } from '@/lib/utils/auth-redirect'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await signIn({ email, password })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push(sanitizeInternalPath(searchParams.get('redirectTo')) ?? ROUTES.PAGES)
      router.refresh()
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>ログイン</CardTitle>
        <CardDescription>Notea へようこそ</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input id="password" type="password" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'ログイン中…' : 'ログイン'}
          </Button>
        </form>
        <GoogleSignInButton />
        <div className="space-y-1 text-center text-sm text-muted-foreground">
          <p>
            <Link href={ROUTES.PASSWORD_RESET} className="underline underline-offset-4">
              パスワードをお忘れですか？
            </Link>
          </p>
          <p>
            アカウントをお持ちでない方は{' '}
            <Link href={ROUTES.REGISTER} className="underline underline-offset-4">
              新規登録
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
```

`components/auth/RegisterForm.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUp } from '@/lib/actions/auth'
import { ROUTES } from '@/lib/constants/routes'
import { signUpSchema } from '@/lib/validations/auth'

export function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = signUpSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '入力内容が正しくありません')
      return
    }
    startTransition(async () => {
      const result = await signUp(parsed.data)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push(ROUTES.VERIFY_EMAIL_SENT)
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>新規登録</CardTitle>
        <CardDescription>無料でアカウントを作成</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input id="password" type="password" required autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">8文字以上で、英字と数字をそれぞれ1文字以上含めてください</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? '登録中…' : '登録する'}
          </Button>
        </form>
        <GoogleSignInButton />
        <p className="text-center text-sm text-muted-foreground">
          すでにアカウントをお持ちの方は{' '}
          <Link href={ROUTES.LOGIN} className="underline underline-offset-4">
            ログイン
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

`components/auth/PasswordResetRequestForm.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordReset } from '@/lib/actions/auth'
import { ROUTES } from '@/lib/constants/routes'

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await requestPasswordReset({ email })
      if (!result.success) {
        setError(result.error)
        return
      }
      setSent(true)
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>パスワード再設定</CardTitle>
        <CardDescription>登録済みのメールアドレスに再設定リンクを送ります</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <p className="text-sm">
            メールを送信しました。受信トレイ（迷惑メールフォルダも）をご確認ください。
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? '送信中…' : '再設定メールを送る'}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href={ROUTES.LOGIN} className="underline underline-offset-4">
            ログインに戻る
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

`components/auth/PasswordResetConfirmForm.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword } from '@/lib/actions/auth'
import { ROUTES } from '@/lib/constants/routes'
import { passwordUpdateSchema } from '@/lib/validations/auth'

export function PasswordResetConfirmForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = passwordUpdateSchema.safeParse({ password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '入力内容が正しくありません')
      return
    }
    startTransition(async () => {
      const result = await updatePassword(parsed.data)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push(ROUTES.PAGES)
      router.refresh()
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>新しいパスワード</CardTitle>
        <CardDescription>新しいパスワードを設定してください</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">新しいパスワード</Label>
            <Input id="password" type="password" required autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">8文字以上で、英字と数字をそれぞれ1文字以上含めてください</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? '更新中…' : 'パスワードを更新'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: ページ作成**

`app/(auth)/login/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'ログイン | Notea', robots: { index: false } }

export default function LoginPage() {
  // LoginForm が useSearchParams を使うため Suspense 必須
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
```

`app/(auth)/register/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = { title: '新規登録 | Notea', robots: { index: false } }

export default function RegisterPage() {
  return <RegisterForm />
}
```

`app/(auth)/register/verify-email-sent/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = { title: '確認メールを送信しました | Notea', robots: { index: false } }

export default function VerifyEmailSentPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>確認メールを送信しました</CardTitle>
        <CardDescription>登録はまだ完了していません</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          メール内のリンクをクリックして登録を完了してください。
          届かない場合は迷惑メールフォルダをご確認ください。
        </p>
        <p className="text-center text-muted-foreground">
          <Link href={ROUTES.LOGIN} className="underline underline-offset-4">
            ログインに戻る
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

`app/(auth)/password-reset/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { PasswordResetRequestForm } from '@/components/auth/PasswordResetRequestForm'

export const metadata: Metadata = { title: 'パスワード再設定 | Notea', robots: { index: false } }

export default function PasswordResetPage() {
  return <PasswordResetRequestForm />
}
```

`app/(auth)/password-reset/confirm/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { PasswordResetConfirmForm } from '@/components/auth/PasswordResetConfirmForm'

export const metadata: Metadata = { title: '新しいパスワードの設定 | Notea', robots: { index: false } }

export default function PasswordResetConfirmPage() {
  return <PasswordResetConfirmForm />
}
```

`app/(main)/layout.tsx`（M2 で 2 カラムシェル化）:

```tsx
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>
}
```

`app/(main)/pages/page.tsx`（M2 で本実装に差し替え）:

```tsx
import type { Metadata } from 'next'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'ページ | Notea', robots: { index: false } }

export default async function PagesHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted-foreground">{user?.email} でログイン中</p>
      <p>まだページがありません</p>
      <SignOutButton />
    </main>
  )
}
```

- [ ] **Step 5: 確認 + Commit**

```bash
npm test && npm run typecheck && npm run lint && npm run build
git add -A && git commit -m "feat: 認証 UI 一式（ログイン/登録/リセット）とアプリ枠を実装"
```

---

### Task 13: 認証 E2E テスト

**Files:**
- Create: `e2e/auth.spec.ts`

- [ ] **Step 1: E2E テストを書く**

`e2e/auth.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'
import { clickAndWaitForUrl } from './helpers/navigation'

const E2E_EMAIL = 'e2e@example.com'
const E2E_PASSWORD = 'Password123'

test('未認証で /pages にアクセスすると /login へリダイレクトされる', async ({ page }) => {
  await page.goto('/pages')
  await page.waitForURL(/\/login\?redirectTo=/)
  await expect(page.getByLabel('メールアドレス')).toBeVisible()
})

test('ログイン → /pages 表示 → ログアウト', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByLabel('メールアドレス').fill(E2E_EMAIL)
  await page.getByLabel('パスワード').fill(E2E_PASSWORD)
  await clickAndWaitForUrl(page, page.getByRole('button', { name: 'ログイン', exact: true }), /\/pages/)
  await expect(page.getByText(E2E_EMAIL)).toBeVisible()
  await clickAndWaitForUrl(page, page.getByRole('button', { name: 'ログアウト' }), /\/login/)
})

test('誤ったパスワードでエラーが表示される', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByLabel('メールアドレス').fill(E2E_EMAIL)
  await page.getByLabel('パスワード').fill('wrong-password-1')
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('正しくありません')
})

test('新規登録すると確認メール案内ページが表示される', async ({ page }) => {
  await page.goto('/register')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByLabel('メールアドレス').fill(`e2e+${Date.now()}@example.com`)
  await page.getByLabel('パスワード').fill('Password123')
  await clickAndWaitForUrl(page, page.getByRole('button', { name: '登録する' }), /\/register\/verify-email-sent/)
  await expect(page.getByText('確認メールを送信しました')).toBeVisible()
})

test('ログイン済みで /login にアクセスすると /pages へリダイレクトされる', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.getByLabel('メールアドレス').fill(E2E_EMAIL)
  await page.getByLabel('パスワード').fill(E2E_PASSWORD)
  await clickAndWaitForUrl(page, page.getByRole('button', { name: 'ログイン', exact: true }), /\/pages/)
  await page.goto('/login')
  await page.waitForURL(/\/pages/)
})
```

- [ ] **Step 2: 実行 → 成功確認**

```bash
# Supabase が起動済みであること（npx supabase status で確認）
npm run test:e2e
```

期待: 5 テスト PASS

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test: 認証フローの E2E テストを追加"
```

---

### Task 14: CI（GitHub Actions）と仕上げ

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: ワークフロー作成**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

env:
  NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder
  NEXT_PUBLIC_APP_URL: http://localhost:3000

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  security:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm audit --audit-level=high
      - uses: github/codeql-action/init@v3
        with: { languages: javascript-typescript }
      - uses: github/codeql-action/analyze@v3

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run test:coverage

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build

  e2e:
    needs: [lint, test, build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: npm ci
      - run: supabase start
      - name: Export Supabase env
        run: |
          eval "$(supabase status -o env)"
          {
            echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
            echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
            echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
          } >> "$GITHUB_ENV"
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: 全体確認**

```bash
npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run test:e2e
```

期待: すべて成功、カバレッジ閾値（branches 80% / 他 85%）クリア

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "ci: GitHub Actions（lint/security/test/build/e2e）を構築"
```

---

## M1 完了条件

- [ ] `npm run lint` / `npm run typecheck` / `npm test`（カバレッジ閾値込み）/ `npm run build` / `npm run test:e2e` がすべて成功
- [ ] メール+パスワードで登録 → 確認メール案内 → （ローカルは Mailpit http://localhost:54324 でリンク踏破）→ ログインできる
- [ ] 未認証アクセスが /login にリダイレクトされ、ログイン後に元のページへ戻る
- [ ] DB に profiles / pages / ai_usage が RLS 有効で存在し、`types/database.ts` が生成済み
- [ ] AI キーに関する環境変数・カラム・引数が**どこにも存在しない**（BYOK 設計の維持）

## 残課題（後続マイルストーンへの引き継ぎ）

- Google OAuth の実鍵設定（`supabase/config.toml` の `[auth.external.google]` + 本番 Dashboard）は実鍵入手後に実施。UI・コールバックは M1 で実装済み
- Sentry 導入は M5（エラーバウンダリ整備と同時）
- 本番 Supabase プロジェクト作成・メールテンプレート設定・Vercel 設定は M5 のリリース手順で実施
