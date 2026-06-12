---
globs: "lib/actions/**/*.ts"
---

# Server Actions ルール

## 必須パターン

すべての Server Action は以下の順序で処理する。
制限チェック（プラン制限・AI回数）は必ず Zod 検証後に行う（不正入力でカウントを消費しないため）。

```typescript
'use server'

export async function myAction(params) {
  // 1. 認証 (制限チェックは含まない)
  const authResult = await requireUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  // 2. Zod バリデーション
  const parsed = schema.safeParse(params)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // 3. 制限チェック (Zod 通過後に実施)
  const limit = await enforcePlanLimit(userId, 'create_page')
  if (limit) return actionError(limit.error)

  // 4. ビジネスロジック (Supabase 操作)
  // 5. キャッシュ無効化: revalidatePath() / revalidateTag()
  // 6. ActionResult で返却
  return actionSuccess({ ... })
}
```

## ActionResult 型

`types/action-result.ts` の `ActionResult<T>` 型と `actionSuccess`/`actionError` ヘルパーを使用:

```typescript
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }
```

### ActionResult を使わない例外

以下のパターンに該当する読み取り Server Action は、`ActionResult<T>` ではなく
`{ data: T[]; nextCursor?: string; error?: string }` 形式を返してよい。

- オートコンプリート / 検索系で、UI 上 fallback として空配列が自然なもの
- カーソル付きリスト取得で、`error` を別フィールドで返す方が呼び出し側を簡潔にできるもの

新規関数を例外として追加する場合は、ファイル冒頭の `@module` JSDoc に
「Returns custom shape instead of ActionResult because ...」と理由を明記すること。

## エラーメッセージ

- `lib/constants/errors.ts` の定数を使用する（インライン文字列を使わない）
- 動的パラメータにはテンプレート関数（`ERR_PAGE_LIMIT_REACHED(max)`）を使用

## マジックナンバー・定数

- 数値リテラル（制限値、タイムアウト等）をコードに直書きしない
- `lib/constants/limits/` の定数を使用。新規追加時は適切なサブファイルに配置
- エラー文字列は `lib/constants/errors.ts`、ルートパスは `lib/constants/routes.ts`

```typescript
// ❌ マジックナンバー
if (count >= 100) return actionError('ページ数の上限に達しました')

// ✅ 定数を使用
import { FREE_MAX_PAGES } from '@/lib/constants/limits'
import { ERR_PAGE_LIMIT_REACHED } from '@/lib/constants/errors'
if (count >= FREE_MAX_PAGES) return actionError(ERR_PAGE_LIMIT_REACHED(FREE_MAX_PAGES))
```

## AI 利用回数の消費

- AI 機能の回数消費は `lib/services/usage.ts` の `consumeAiUsage(userId, provider)` 経由のみ
- カウントの increment は **アトミックに**行う（read-modify-write の競合を避けるため、
  DB 関数または `upsert` + 条件付き update を使う）
- Action から **ユーザーの API キーを受け取らない**。引数の型に `apiKey` のようなフィールドを
  含めてはならない（`.claude/rules/ai-byok.md` 参照）

## 既存ヘルパーの再利用

新しい Action を書く前に、以下に同等機能がないか確認する:
- `lib/actions/utils.ts` — `requireUser`, `requirePaidUser`, `enforcePlanLimit`
- `lib/services/usage.ts` — `consumeAiUsage`, `getStorageUsage`, `getPageCount`
- `lib/services/page-tree.ts` — ページ階層の取得・移動・循環参照チェック

## セキュリティ

- Server Actionsでは**必ず認証・認可チェック**（RLS があっても Action 側でも確認する。Defense in Depth）
- ユーザー入力は**必ずZodバリデーション**
- 機密情報は環境変数（`NEXT_PUBLIC_` なしはサーバーのみ）
- `SUPABASE_SERVICE_ROLE_KEY` を使う処理は `lib/supabase/admin.ts` 経由のみ。通常 Action では使わない
