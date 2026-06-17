-- M7 共有機能。ページ単位の共有リンク（閲覧のみ / 編集可）。
-- トークンを知る人がアクセスできる。匿名は閲覧のみ、編集はログイン必須。

-- page_shares: 1 ページにつき permission ごとに最大1本の共有リンクを持つ。
create table public.page_shares (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  permission text not null check (permission in ('view', 'edit')),
  created_at timestamptz not null default now(),
  unique (page_id, permission)
);

create index page_shares_page_idx on public.page_shares (page_id);

alter table public.page_shares enable row level security;

-- 所有者のみが自分の共有を管理できる。失効は delete で行うため update ポリシーは不要。
-- 匿名/非所有者のトークン解決は SECURITY DEFINER 関数経由（このテーブルを直接 select させない）。
create policy "owner_select" on public.page_shares for select using (auth.uid() = user_id);
create policy "owner_insert" on public.page_shares for insert with check (auth.uid() = user_id);
create policy "owner_delete" on public.page_shares for delete using (auth.uid() = user_id);

grant select, insert, delete on public.page_shares to authenticated;
grant select, insert, update, delete on public.page_shares to service_role;

-- トークン → 共有ページを返す。view/edit 両対応・ごみ箱は除外。
-- SECURITY DEFINER で RLS をバイパスするが、トークン一致 + 非ごみ箱に限定して返すため安全。
-- owner_id 等の内部 ID は返さない（匿名へ漏らさない）。
create function public.get_shared_page(p_token text)
returns table (
  id uuid,
  title text,
  icon text,
  content jsonb,
  content_text text,
  updated_at timestamptz,
  permission text
)
language sql
security definer
set search_path = ''
as $$
  select p.id, p.title, p.icon, p.content, p.content_text, p.updated_at, s.permission
  from public.page_shares s
  join public.pages p on p.id = s.page_id
  where s.token = p_token
    and p.is_trashed = false;
$$;

-- 共有編集リンク経由のページ更新。permission='edit' かつ呼び出し元が認証済みの場合のみ許可。
-- 匿名（auth.uid() is null）は拒否する（編集はログイン必須）。
create function public.update_shared_page(
  p_token text,
  p_content jsonb,
  p_content_text text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select s.page_id into v_page_id
  from public.page_shares s
  join public.pages p on p.id = s.page_id
  where s.token = p_token
    and s.permission = 'edit'
    and p.is_trashed = false;

  if v_page_id is null then
    raise exception 'SHARE_NOT_FOUND';
  end if;

  update public.pages
  set content = p_content,
      content_text = p_content_text,
      updated_at = now()
  where id = v_page_id;
end;
$$;

-- 匿名でも閲覧トークンを解決できるよう anon にも execute を付与する。
grant execute on function public.get_shared_page(text) to anon, authenticated;
-- 編集は認証必須。anon には付与しない。
grant execute on function public.update_shared_page(text, jsonb, text) to authenticated;
grant execute on function public.get_shared_page(text) to service_role;
grant execute on function public.update_shared_page(text, jsonb, text) to service_role;
