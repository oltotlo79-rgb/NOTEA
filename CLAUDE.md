---
description:
alwaysApply: true
---

# CLAUDE.md

Notea — Notion 風メモ・ドキュメント作成 Web アプリ。
最大の特徴: AI 機能はユーザー自身の API キー（BYOK）で動き、キーはブラウザにのみ保存される（サーバーは鍵を持たない）。

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動 (http://localhost:3010 — 3000 は他プロジェクトが使用)
npm run build    # 本番ビルド
npm run start    # 本番サーバー起動
npm run lint     # ESLint実行

# Supabase（ローカル開発は Docker 必須）
npx supabase start                 # ローカルSupabase一式起動 (DB/Auth/Storage/Studio)
npx supabase stop                  # 停止
npx supabase db reset              # マイグレーション再適用 + seed
npx supabase migration new <name>  # マイグレーションファイル作成
npx supabase db push               # リンク済みリモートにマイグレーション適用
npx supabase gen types typescript --local > types/database.ts  # 型生成（スキーマ変更後必須）

# テスト
npm test              # ユニットテスト (Vitest)
npm run test:coverage # カバレッジ付き
npm run test:e2e      # E2Eテスト (Playwright)
npm run test:all      # 全テスト実行
```

## CI/CD（GitHub Actions）

| ジョブ | 内容 | 実行タイミング |
|--------|------|--------------|
| lint | ESLint + TypeScript型チェック | 常時 |
| security | npm audit（high/critical ゲート）+ CodeQL | 常時 |
| test | ユニットテスト（カバレッジゲート） | 常時 |
| build | ビルド確認 | 常時 |
| e2e | E2Eテスト（Playwright） | 常時（lint/test/build 成功後） |

## 技術スタック

- **フレームワーク**: Next.js (App Router) / React / TypeScript (strict)
- **スタイリング**: Tailwind CSS 4 + shadcn/ui
- **エディタ**: BlockNote（ブロック型エディタ。Notion 風 UI が標準で揃う）
- **状態管理**: React Query (サーバー状態) + useState/Context (クライアント状態)
- **DB / 認証 / ストレージ**: Supabase（PostgreSQL + RLS / Auth: メール+Google / Storage: 画像）
- **AI**: BYOK — ユーザー自身のキーでブラウザから直接プロバイダ API を呼ぶ（無料: Gemini / 有料: OpenAI・Anthropic も可）
- **決済**: Stripe（第2弾で導入） / **監視**: Sentry
- **デプロイ**: Vercel / **Cron**: Vercel Cron

## 核心ルール

1. **デフォルトはServer Component** — `'use client'`はHooks/イベント/ブラウザAPI使用時のみ
2. **Server ActionsはActionResult型で返却** — `types/action-result.ts` の `actionSuccess`/`actionError` を使用
3. **全Actionで認証→Zodバリデーション→制限チェックの順** — `requireUser()` → `schema.safeParse` → `enforcePlanLimit()` / `consumeAiUsage()`
4. **リスト取得はカーソルベースページネーション** — offset不使用
5. **エラーメッセージは `lib/constants/errors.ts` の定数を使用** — インライン文字列禁止
6. **AI の API キーをサーバーに保存・送信・記録しない** — 鍵はブラウザ保存のみ（`lib/ai/key-storage.ts` 経由）。サーバーが記録してよいのは「使った回数」だけ。詳細は `.claude/rules/ai-byok.md`
7. **マジックナンバー禁止** — 数値・文字列リテラルは `lib/constants/` の定数を使用（プラン制限は `limits/`、ルートは `routes.ts`）
8. **`any` / `as` キャスト禁止** — 型ガードか Zod で安全に絞り込む。strict mode を維持
9. **全テーブルで RLS 有効化必須** — owner ポリシー（`user_id = auth.uid()`）を基本とし、service_role はサーバー専用 `lib/supabase/admin.ts` のみ
10. **既存ヘルパーを再利用** — 新コード追加前に `lib/actions/utils.ts`, `lib/utils/`, `lib/constants/` を確認し、同等機能があればそれを使う
11. **新機能・バグ修正にはテストを伴う** — カバレッジ閾値（branches 80%, functions/lines/statements 85%）を下回らない

## アーキテクチャ

```
app/
├── (auth)/        # 認証ページ (login, register, password-reset, auth/callback)
├── (main)/        # メインアプリ (pages/[id] エディタ, settings, search※第2弾, trash)
├── (legal)/       # プライバシー, 利用規約, 特商法
├── (public)/      # ランディング, about, help
└── api/           # Route Handlers (Stripe webhook※第2弾, AIパススルー, cron)
components/        # editor, sidebar, auth, page, settings, ai, common, ui 等
lib/
├── actions/       # Server Actions（認証→Zod→制限チェック→ロジック）
├── services/      # 複数Actionから呼ばれる再利用ロジック (usage.ts, page-tree.ts 等)
├── supabase/      # server.ts / client.ts / middleware.ts / admin.ts（service_role・サーバー専用）
├── ai/            # ブラウザ専用: key-storage.ts, providers/ (gemini, openai, anthropic)
├── images/        # ブラウザ専用: compress.ts（アップロード前の長辺2048px縮小+WebP変換）
└── constants/     # エラーメッセージ, プラン制限値, ルート定数
types/             # ActionResult, database.ts（Supabase生成型）
hooks/             # usePageTree, useAiKey, useAutosave 等
supabase/migrations/  # SQLマイグレーション（RLSポリシー含む）
```

## 機能制約（プラン制限）

- 無料: ページ合計100まで / 画像合計200MBまで / AI 1日5回（Gemini キーのみ登録可）
- 有料（¥300/月・¥3,000/年）: ページ無制限 / 画像5GB / AI 1日100回 / OpenAI・Anthropic キーも登録可
- 画像はブラウザ側で圧縮してから保存 — 長辺2048px・WebP品質80 に変換（`lib/images/compress.ts`）。受付は原画20MBまで・保存は圧縮後5MBまで。対応形式 JPEG/PNG/WebP（GIF 非対応）
- 制限値はすべて `lib/constants/limits/` の定数（コード直書き禁止）
- AI 利用回数はサーバーが日次でカウント（JST 0時リセット。鍵・プロンプト・応答は記録しない）

## UI/UXガイドライン

- Notion 風のミニマルで清潔なデザイン（白基調・グレー・控えめなアクセント1色）
- デスクトップ: 2カラム（左サイドバー: ページツリー / 右: エディタ）
- モバイル: 1カラム + ドロワーでサイドバー表示
- ブラウザのみで PC・スマホ両対応（専用アプリは作らない）

## パスエイリアス

`@/*` でプロジェクトルートからインポート: `import { createClient } from '@/lib/supabase/server'`

## 環境変数

```bash
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase（anonはRLS前提で公開可）
SUPABASE_SERVICE_ROLE_KEY                                # サーバー専用。クライアントに絶対に出さない
NEXT_PUBLIC_APP_URL                                      # アプリURL
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  # Stripe（第2弾）
SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN                       # Sentry
CRON_SECRET                                              # Cron認証
```

AI プロバイダのキー用環境変数は **存在しない**（ユーザーのブラウザにのみ保存されるため）。

## 詳細ルール

機能別の詳細なパターン・規約は `.claude/rules/` に分割:

| ルールファイル | 適用対象 |
|--------------|---------|
| `architecture.md` | レイヤ分離・actions/services 判断基準 |
| `nextjs-components.md` | ページ・コンポーネント作成 |
| `nextjs-data-fetching.md` | データ取得・キャッシュ |
| `server-actions.md` | Server Action実装 |
| `nextjs-api-routes.md` | APIルート |
| `nextjs-proxy.md` | proxy.ts（セッション更新・保護ルート） |
| `nextjs-performance.md` | パフォーマンス最適化 |
| `nextjs-error-handling.md` | エラーハンドリング |
| `supabase-database.md` | DB・RLS・マイグレーション |
| `auth-supabase.md` | 認証（Supabase Auth） |
| `ai-byok.md` | AI機能・APIキー取り扱い（セキュリティの肝） |
| `testing.md` | テスト |
| `setup.md` | 開発環境セットアップ |
| `comments.md` | コメント規約・WHY/WHAT判断基準 |
