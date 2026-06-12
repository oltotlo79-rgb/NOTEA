---
globs: "supabase/config.toml, .env.local.example, vercel.json"
---

# 開発環境セットアップ

## 前提

- Node.js (LTS) / npm
- Docker Desktop（ローカル Supabase 用）
- Supabase CLI（`npx supabase` で利用可）

## 方法1: ローカル Supabase（推奨）

```bash
cp .env.local.example .env.local   # supabase start の出力した URL/anon key を設定
npm install
npx supabase start                 # DB / Auth / Storage / Studio が起動
npx supabase db reset              # マイグレーション + seed 適用
npm run dev                        # http://localhost:3000
```

- Studio: http://localhost:54323 （テーブル・RLS・Storage の確認）
- 停止: `npx supabase stop`

## 方法2: クラウド Supabase 直結（ローカル Docker が使えない場合）

```bash
cp .env.local.example .env.local   # 開発用プロジェクトの URL / anon key を設定
npm install
npx supabase link --project-ref <dev-project-ref>
npx supabase db push               # マイグレーション適用
npm run dev
```

**本番プロジェクトに直結して開発しない。** 開発用プロジェクトを分ける。

## スキーマ変更の流れ

```bash
npx supabase migration new <name>   # SQL を書く（RLS ポリシー込み）
npx supabase db reset               # ローカルで検証
npx supabase gen types typescript --local > types/database.ts  # 型再生成
```

## Google OAuth（ローカル）

- ローカルの Google ログインは `supabase/config.toml` の `[auth.external.google]` に
  client_id / secret を設定（値は `.env` 経由で渡し、コミットしない）
- リダイレクト URI: `http://localhost:54321/auth/v1/callback`

## AI 機能の動作確認

- AI キーは環境変数ではない。アプリの設定画面から自分のキー（例: Gemini 無料キー）を
  ブラウザに登録して確認する
- 自動テストではプロバイダ API をモックする（`testing.md` 参照）
