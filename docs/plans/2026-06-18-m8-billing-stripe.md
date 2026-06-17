# M8: 課金（Stripe サブスクリプション）実装計画

> 要件定義書 3.6、.claude/rules/ 準拠。第2弾の課金機能。検索(M6)・共有(M7)に続く。

**Goal:** プレミアムプラン（月額300円 / 年額3,000円）を Stripe Checkout で購入でき、Webhook で `profiles.plan` を更新する。カスタマーポータルで解約・カード変更。解約時は free に戻す（既存データは保持、上限超過分は新規作成のみ不可）。

## 設計判断
- **Checkout はサーバー側リダイレクト方式**（Stripe.js をクライアントに載せない）。CSP/バンドルを汚さず、鍵もサーバーのみ。
- **Webhook が唯一の plan 更新経路**。`profiles.plan` をユーザーが自分で書き換えられないよう、profiles の UPDATE 権限を列単位（display_name のみ）に絞る（**重要なセキュリティ修正**。現状はテーブル全体 update 可で自己アップグレード可能）。
- **冪等性**: `webhook_events` テーブルに event id を記録し、Stripe のリトライ重複を防ぐ。
- plan 更新・stripe_customer_id 保存・webhook は `lib/supabase/admin.ts`（service_role）経由（ユーザーセッションを介さない / RLS バイパスが必要なため）。

## タスク

### M8-T1（backend: DB）
- `supabase/migrations/<ts>_billing.sql`:
  - profiles に `stripe_customer_id text unique`, `plan_current_period_end timestamptz` を追加。
  - **権限修正**: `revoke update on public.profiles from authenticated; grant update (display_name) on public.profiles to authenticated;`（plan / stripe_* 列を自己更新不可に）。
  - `webhook_events`（id text pk = Stripe event id, type text, created_at）。RLS 有効・ポリシー無し（service_role のみアクセス）。`grant ... to service_role`。
  - 型再生成。

### M8-T2（backend: Stripe 配線）
- `lib/stripe/server.ts`（`import 'server-only'`）: STRIPE_SECRET_KEY から Stripe クライアント生成。
- `lib/constants/billing.ts`: プラン定義（monthly/yearly の価格 env キー名・表示価格）。価格 ID は env（STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY）。
- `lib/actions/billing.ts`:
  - `createCheckoutSession(plan)`: requireUser → Stripe customer 取得/作成（admin で stripe_customer_id 保存）→ Checkout セッション（mode=subscription, success/cancel URL, metadata.userId）→ ActionResult<{ url }>。
  - `createPortalSession()`: requireUser → stripe_customer_id → Billing Portal セッション → ActionResult<{ url }>。
- `app/api/webhooks/stripe/route.ts`: 署名検証（constructEvent, raw body）→ webhook_events で冪等ガード → checkout.session.completed / customer.subscription.updated|deleted で profiles.plan・period_end を admin 更新。`Cache-Control: no-store`、ボディ/鍵を記録しない。proxy は /api を除外済み＝route 内が最終防衛線。
- 単体: createCheckoutSession（未認証/正常）、createPortalSession（customer 無し）、webhook（署名不正401・重複は二重処理しない・subscription 状態→plan 反映）。Stripe は vi.mock。

### M8-T3（frontend）
- `app/(main)/settings/plan/page.tsx`（RSC・noindex）: 現プラン表示。無料→月額/年額アップグレードボタン。有料→「お支払い管理」ボタン + 更新日。
- `components/settings/PlanView.tsx`（client）: createCheckoutSession/createPortalSession を呼び返り URL へ遷移。ローディング/エラー。
- 設定ナビ・カードに「プラン」追加（routes.ts に SETTINGS_PLAN）。usage ページのアップグレード導線を /settings/plan に向ける。
- 単体: PlanView（無料はアップグレード・有料は管理ボタン・クリックで action 呼び出し→遷移）。

### M8-T4（運用・ドキュメント）
- `.env.local.example` に Stripe 変数を追記。
- ユーザー作業手順（Stripe アカウント・商品/価格・鍵・Webhook 設定）を非技術者向けに提示。

## 完了条件
- 無料ユーザーが月額/年額を選んで Checkout に遷移できる（鍵があれば実決済まで）。
- Webhook で plan が paid/free に正しく反映され、重複イベントを二重処理しない。
- ユーザーが自分で plan を書き換えられない（列権限）。
- 全テスト緑・カバレッジ閾値・既存機能と BYOK 不変。
- 実 Stripe 鍵が無い CI/ローカルでも単体（モック）で検証可能。実決済 E2E は鍵設定後に手動確認。
