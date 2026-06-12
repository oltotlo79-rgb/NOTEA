---
globs: "app/api/**/*.ts, app/api/**/*.tsx"
---

# API Routes (Route Handlers) ルール

## 使い分け

- **Server Actions優先** — フォーム送信・データ変更
- **Route Handlers** — 外部連携、Webhook、Cronジョブ、AIパススルー

## 規約

- `app/api/` 配下に `route.ts` を作成
- HTTPメソッドごとに関数をエクスポート (`GET`, `POST`, `PUT`, `DELETE`)

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  return NextResponse.json(data)
}

// Dynamic Route
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
}
```

## Cronジョブ

- `verifyCronAuth()` で認証: `Authorization: Bearer <CRON_SECRET>`（Vercel Cron 互換）
- スケジュールは `vercel.json` で定義

## Webhook（第2弾: Stripe）

- Stripe: `stripe.webhooks.constructEvent()` で署名検証
- べき等性チェック（重複処理防止）
- DB 書き込みは `lib/supabase/admin.ts`（service_role）経由
  — webhook にはユーザーセッションが無いため

## AI パススルールート（例外的に許可される唯一の鍵通過点）

ブラウザから直接呼べないプロバイダ（CORS 非対応の OpenAI 等）のために、
`app/api/ai/proxy/route.ts` でリクエストを転送する場合は以下を厳守:

- [ ] 鍵は `Authorization` ヘッダで受け、**そのまま転送して破棄**する
- [ ] 鍵・プロンプト・応答を **ログ・DB・キャッシュに一切残さない**（`Cache-Control: no-store`）
- [ ] Sentry 等の監視に鍵が乗らないよう、エラー時もヘッダ・ボディを記録しない
- [ ] 認証済みユーザーのみ利用可（`supabase.auth.getUser()` で確認）
- [ ] 転送前に `consumeAiUsage()` で回数を消費する
- [ ] 転送先はプロバイダ公式ドメインの allowlist のみ（SSRF 防止。任意 URL への転送禁止）

詳細は `.claude/rules/ai-byok.md`。

## proxy.ts との関係 (重要)

`proxy.ts` は `/api/*` パスを認証リダイレクトの対象外とする設計。
これは webhook / 外部連携 / cron に対しリダイレクトを発生させないための意図的な分岐であり、
**API route の保護責任は route handler 内に集約される**。

new API route を追加する際は必ず以下を route 内で確認すること:

- [ ] 認証: 公開 webhook 以外は `supabase.auth.getUser()` または `verifyCronAuth()` 等で identity を確認
- [ ] 認可: ユーザー固有リソースなら `userId` 一致で gate（RLS だけに頼らない）
- [ ] 入力検証: Zod safeParse でクエリ・ボディを検証
- [ ] レート制限: `consumeAiUsage` / route-specific token bucket
- [ ] 署名検証: webhook なら `constructEvent` / Bearer 比較
- [ ] べき等性: 同 event 二重処理を防ぐ guard

これら全てが proxy で守られない以上、route handler は **fail-closed の最終防衛線** として
振る舞う必要がある。
