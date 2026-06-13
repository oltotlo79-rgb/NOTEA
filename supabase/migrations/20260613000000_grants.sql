-- Supabase ローカル CLI では default privileges が自動付与されないため、
-- authenticated ロールに対してテーブルレベルの GRANT を明示する。
-- RLS ポリシーは「どの行を見せるか」の制御であり、テーブルへのアクセス権とは別概念。
-- GRANT(テーブルアクセス許可) + RLS(行フィルタ) の二段構えで正しく機能する。

-- pages: 認証ユーザーが CRUD できる（行レベルは owner RLS が制御）
grant select, insert, update, delete on public.pages to authenticated;

-- profiles: insert はトリガー（handle_new_user / security definer）経由、
--           delete は auth.users の cascade のため、select と update のみ付与
grant select, update on public.profiles to authenticated;

-- ai_usage: 書き込みは consume_ai_usage 関数（security definer）経由のみ、
--           自分のレコードを参照するための select のみ付与
grant select on public.ai_usage to authenticated;

-- 関数の EXECUTE は PostgreSQL デフォルトで public（= 全ロール）に付与済みのため
-- 追加 GRANT は不要。ただし security definer 関数（consume_ai_usage, handle_new_user）は
-- 呼び出し元の権限ではなく定義者（postgres）権限で動くため、テーブル GRANT とは独立して機能する。

-- service_role: M5 cron（cleanup-trash 等）が admin クライアント経由で操作するために必要。
-- service_role は RLS をバイパスするが、GRANT がないとテーブルアクセス自体が拒否される。
grant select, insert, update, delete on public.pages to service_role;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.ai_usage to service_role;
grant execute on function public.count_user_pages() to service_role;
grant execute on function public.move_page(uuid, uuid) to service_role;
grant execute on function public.consume_ai_usage(text, integer) to service_role;

-- move_page: search_path を '' に固定してスキーマ注入攻撃を防ぐ。
-- init.sql は既コミットのため、ここで create or replace して上書きする。
-- security invoker のまま維持（RLS を通す = 他人のページを動かせない保証）。
-- 本体のテーブル参照はすべて public. 修飾済みのため search_path='' でも動作する。
create or replace function public.move_page(p_page_id uuid, p_new_parent_id uuid)
returns void
language plpgsql
set search_path = ''
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
