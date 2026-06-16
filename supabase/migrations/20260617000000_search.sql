-- pg_trgm を使った部分一致検索インデックス。
-- ILIKE '%query%' に対して GIN + trgm ops でインデックスが効く。
-- 日本語の 1〜2 文字は trigram が生成されないため完全一致は不可能だが、
-- 3 文字以上の日本語や英数字の部分一致は高速化される。
-- pg_bigm はローカル Supabase (supabase/postgres イメージ) に含まれないため pg_trgm を採用。
create extension if not exists pg_trgm with schema extensions;

-- title と content_text を連結した生成列を作り、1 つの GIN インデックスで両方を賄う。
-- 分離した 2 つの GIN インデックスより、OR 検索時の Plan が安定する。
-- STORED を指定することで UPDATE のたびに自動更新される。
alter table public.pages
  add column if not exists search_text text generated always as (
    coalesce(title, '') || ' ' || coalesce(content_text, '')
  ) stored;

create index if not exists pages_search_trgm_idx
  on public.pages
  using gin (search_text extensions.gin_trgm_ops);

-- search_text 列は generated だが authenticated ロールの select GRANT が必要。
-- 既存の `grant select ... on public.pages to authenticated;` は列レベルではなく
-- テーブルレベルのため、新列にも自動で適用される。追加 GRANT 不要。
