-- M8 課金（Stripe サブスクリプション）。

-- profiles に Stripe 連携カラムを追加。
alter table public.profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists plan_current_period_end timestamptz;

-- セキュリティ修正: これまで authenticated にテーブル全体の UPDATE を付与していたため、
-- ユーザーがブラウザから自分の profiles.plan を 'paid' に書き換えられた（自己アップグレード）。
-- plan / stripe_customer_id / plan_current_period_end は Webhook（service_role）だけが
-- 更新してよい。UPDATE 権限を display_name 列に限定する。
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Webhook イベントの冪等性ガード。Stripe はリトライで同じ event を複数回送るため、
-- 受信済み event id を記録して二重処理を防ぐ。
create table public.webhook_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

-- service_role（admin クライアント = Webhook）専用。ユーザーには一切公開しない。
-- service_role は RLS をバイパスするが GRANT が無いとアクセス自体が拒否されるため付与する。
-- profiles の service_role 更新権限は既存 grants.sql で付与済み（plan 更新に使う）。
alter table public.webhook_events enable row level security;
grant select, insert on public.webhook_events to service_role;
