---
globs: "supabase/**/*.sql, lib/supabase/**/*.ts, types/database.ts"
---

# Supabase + PostgreSQL ルール

## クライアントの使い分け

| クライアント | ファイル | 用途 |
|------------|---------|------|
| Server | `lib/supabase/server.ts` | Server Component / Server Action（cookie のユーザーセッションで RLS が効く） |
| Browser | `lib/supabase/client.ts` | Client Component（anon キー + ユーザーセッション） |
| Admin | `lib/supabase/admin.ts` | service_role。**webhook / cron 専用**。`import 'server-only'` 必須 |

- データ変更は原則 **Server Action（server クライアント）経由**。Client Component から
  browser クライアントで直接 write しない（制限チェック・バリデーションを一元化するため）
- Realtime / Storage アップロードなど browser クライアントが必要な箇所は例外として明示する

## RLS（最重要）

- **全テーブルで `ENABLE ROW LEVEL SECURITY` 必須**。RLS なしのテーブルをマイグレーションに含めない
- 基本は owner ポリシー:

```sql
alter table pages enable row level security;

create policy "owner_select" on pages for select using (auth.uid() = user_id);
create policy "owner_insert" on pages for insert with check (auth.uid() = user_id);
create policy "owner_update" on pages for update using (auth.uid() = user_id);
create policy "owner_delete" on pages for delete using (auth.uid() = user_id);
```

- 共有機能（第2弾）を入れるまで、他人の行が見えるポリシーを作らない
- Storage バケットも同様: ユーザーごとのプレフィックス（`{user_id}/...`）で
  ポリシーを切る。公開バケットにしない

## スキーマ規約

- テーブル名・カラム名: `snake_case`
- ID: `uuid primary key default gen_random_uuid()`
- 日時: `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`（trigger で更新）
- 外部キー: `references ... on delete cascade` を明示
- ページ階層: `parent_id uuid references pages(id) on delete cascade`（自己参照）

## マイグレーション

```bash
npx supabase migration new add_pages_table  # supabase/migrations/ にSQL作成
npx supabase db reset                       # ローカルに全マイグレーション再適用
npx supabase db push                        # リモートに適用
npx supabase gen types typescript --local > types/database.ts  # 型再生成（必須）
```

- スキーマ変更は必ずマイグレーションファイルで行う。Dashboard の Table Editor で直接変更しない
  （ローカルと本番がずれるため）
- マイグレーションには RLS ポリシー・index・trigger も含める

## クエリパターン

```typescript
// 読み取り（select で必要なカラムのみ。'*' を本番コードで使わない）
const { data: page } = await supabase
  .from('pages')
  .select('id, title, content, parent_id, updated_at')
  .eq('id', id)
  .single()

// リレーション込み取得（embedded select）
const { data } = await supabase
  .from('pages')
  .select('id, title, children:pages(id, title)')
  .is('parent_id', null)
```

- `.single()` は0件でエラーになる。「無いのが正常」な取得は `.maybeSingle()` を使う
- エラーは握りつぶさない: `if (error) return actionError(ERR_DB)` のように必ず処理する

## ページネーション（カーソルベース）

```typescript
const { data: items } = await supabase
  .from('pages')
  .select('id, title, updated_at')
  .order('updated_at', { ascending: false })
  .order('id', { ascending: false })          // 同時刻のタイブレーク
  .lt('updated_at', cursor ?? 'infinity')
  .limit(limit)
const nextCursor = items.length === limit ? items[items.length - 1]?.updated_at : undefined
```

`.range(from, to)`（offset 方式）はリストが伸びると重くなるため使わない。

## N+1クエリ防止

- **ループ内でクエリを実行しない** — 事前に `.in('id', ids)` で一括取得
- リレーションは embedded select で同時取得
- ページツリー全体は1クエリで全行取得し、アプリ側で木に組み立てる
  （階層ごとに再帰クエリしない）

## トランザクション

supabase-js 単体に複数文トランザクションは無い。複数テーブルをアトミックに更新する処理は
**Postgres 関数（`create function ... language plpgsql`）をマイグレーションで定義し、`.rpc()` で呼ぶ**:

```typescript
const { error } = await supabase.rpc('move_page', { page_id, new_parent_id })
```

例: ページ移動（循環参照チェック + parent_id 更新）、AI 回数のアトミック increment。
