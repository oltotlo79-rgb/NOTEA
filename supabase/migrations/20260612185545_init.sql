-- Notea 第1弾スキーマ全量（profiles / pages / ai_usage / Storage / 関数）
-- 制限値の対応: 深さ10 = MAX_PAGE_DEPTH, 5242880 = MAX_IMAGE_STORED_SIZE_MB 相当

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
