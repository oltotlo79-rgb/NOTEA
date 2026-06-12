# アーキテクチャ規約

## レイヤ構造

プロジェクトは以下の層に分かれる。上から下への依存のみ許可、逆方向・横断依存は禁止。

```
┌────────────────────────────────────────────────────────────┐
│  components/, app/    (Presentation)                       │
│  └─ UI / Server Component / Client Component               │
├────────────────────────────────────────────────────────────┤
│  lib/actions/         (Controller + UseCase)               │
│  └─ Server Action: 認証 → Zod → 制限チェック → ロジック    │
├────────────────────────────────────────────────────────────┤
│  lib/services/        (Reusable Domain Logic)              │
│  └─ 複数 Action から呼ばれる再利用ロジック                 │
├────────────────────────────────────────────────────────────┤
│  lib/supabase/, lib/* (Infrastructure / Utility)           │
│  └─ Supabaseクライアント / 環境変数 / 純粋関数             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  lib/ai/  (Browser-only AI Layer) ※サーバー層から独立     │
│  └─ key-storage.ts / providers/ — ブラウザ専用。           │
│     サーバーモジュール (lib/supabase/server 等) を         │
│     import してはならない。逆も禁止。                      │
└────────────────────────────────────────────────────────────┘
```

## `lib/actions/` vs `lib/services/` 判断基準

### `lib/actions/` に置く
- **`'use server'` 付きの UI エンドポイント**（Server Action）
- 外部（`components/`）から直接呼ばれる
- 必ず **認証・認可・バリデーション・制限チェック** を実施
- 戻り値は `ActionResult<T>`

### `lib/services/` に置く
- **複数の Action から共有される非自明なロジック**
- 例: `usage.ts`（AI回数・プラン制限カウント）、`page-tree.ts`（ページ階層操作）
- 外部（`components/`）から **直接は呼ばれない**
- 認証は呼び出し元（Action）が済ませている前提
- 戻り値は素の値または domain-specific な型

### 判断フロー

```
クライアントから直接呼ぶ？
├─ Yes → lib/actions/{feature}.ts  （Server Action）
└─ No
   ├─ 複数ファイルから呼ばれる再利用ロジック？
   │   └─ Yes → lib/services/{name}.ts
   └─ 単発の計算・変換・定数？
       └─ lib/utils/ or 同じ Action 内の private 関数
```

## `lib/supabase/` の構成

| ファイル | 役割 | 実行環境 |
|---------|------|---------|
| `server.ts` | Server Component / Server Action 用クライアント（cookie ベース） | サーバー |
| `client.ts` | Client Component 用クライアント（anon キー） | ブラウザ |
| `middleware.ts` | `proxy.ts` から呼ぶセッション更新ヘルパー | Edge |
| `admin.ts` | service_role クライアント。**`import 'server-only'` 必須** | サーバーのみ |

`admin.ts` は RLS をバイパスするため、Stripe webhook・cron 等の「ユーザーセッションが無い処理」専用。
通常の Action では使わない（RLS を通すことが認可の二重チェックになる）。

## `lib/ai/` の扱い（ブラウザ専用層）

- ユーザーの API キーを扱うコードはすべて `lib/ai/` に隔離する
- このディレクトリのコードは **Client Component からのみ** import する
- `lib/actions/` や `lib/services/` から `lib/ai/` を import してはならない（鍵がサーバーに渡る経路を作らないため）
- 詳細は `.claude/rules/ai-byok.md`

## Server Action 必須パターン

制限チェック（プラン制限・AI回数）は必ず Zod 検証後に実行する（不正入力でカウントを消費しないため）。

```typescript
'use server'

export async function myAction(input: MyInput): Promise<ActionResult<MyResult>> {
  // 1) 認証 (制限チェックは含まない)
  const auth = await requireUser()
  if ('error' in auth) return actionError(auth.error)

  // 2) Zod によるランタイム検証 (FormData でも typed object でも)
  const parsed = mySchema.safeParse(input)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // 3) 制限チェック (Zod 通過後に実施) — 例: enforcePlanLimit / consumeAiUsage
  const limit = await enforcePlanLimit(auth.userId, 'create_page')
  if (limit) return actionError(limit.error)

  // 4) ビジネスロジック (または services 層へ委譲)
  // 5) revalidatePath() / revalidateTag() でキャッシュ更新
  // 6) actionSuccess(...) で返す
}
```

## 共有コンポーネント

### Supabase クエリ形状
- **3 箇所以上で同じ形になる** `select(...)` 文字列は `lib/supabase/shared-selects.ts` に集約
- 例: `PAGE_LIST_SELECT`（ツリー表示に必要な最小カラム）、`PAGE_DETAIL_SELECT`
- 純粋な文字列定数のため `lib/services/` / `lib/actions/` 双方から安全に import 可能（依存方向中立）
- 1〜2 箇所でしか使わないものは各ファイル内で定義してよい

### Hooks
- 複数コンポーネントから使う Client 処理は `hooks/use-{name}.ts` に
- 例: `usePageTree`, `useAutosave`, `useAiKey`

### 定数
- マジックナンバー・マジック文字列は必ず `lib/constants/` 配下に集約
- ドメイン別サブファイル（`limits/`, `errors.ts`, `routes.ts`）

#### Next.js Route Segment Config の制約

`export const revalidate` / `export const dynamic` など **Route Segment Config** は
Next.js がビルド時に静的解析するため、**リテラル値以外は受け付けない**
（import された定数はエラーになる）。
意図を示すためにコメントで定数名を併記する:

```ts
// NG: Next.js がビルド失敗
// export const revalidate = REVALIDATE_PUBLIC_PAGE

// OK: リテラル + 識別用コメント
export const revalidate = 3600 // REVALIDATE_PUBLIC_PAGE 相当
```

この制約はサーバーサイドのビジネスロジックには適用されない
（`unstable_cache` の `revalidate` オプションは通常の定数で OK）。

## 依存方向の遵守

```
✅ components/ → lib/actions/        // UI が Action を呼ぶ
✅ components/(client) → lib/ai/     // Client Component が AI 層を使う
✅ lib/actions/ → lib/services/      // Action が共有ロジックを使う
✅ lib/services/ → lib/supabase/server  // Service が Supabase を使う
❌ lib/actions/ → components/        // Action が UI に依存（禁止）
❌ lib/services/ → lib/actions/      // Service が Action を呼ぶ（循環になる）
❌ lib/actions/ → lib/ai/            // サーバーコードが AI 鍵層に触れる（禁止）
❌ lib/ai/ → lib/supabase/server     // ブラウザ層がサーバー専用コードに依存（禁止）
```

## 拡張時のチェックリスト

新機能 X を追加するとき:

- [ ] `components/{x}/` に UI を配置
- [ ] `lib/actions/{x}.ts` に Server Action を配置
- [ ] 認証/Zod/制限チェック 3 点セットを確認
- [ ] 他 Action と共有するロジックがあれば `lib/services/{x}-helpers.ts` に切り出し
- [ ] 定数・制限値を `lib/constants/limits/` に追加
- [ ] 新テーブルなら `supabase/migrations/` に RLS ポリシー込みで追加 + 型再生成
- [ ] テストを `__tests__/lib/actions/{x}.test.ts` に配置
- [ ] `revalidatePath` / `revalidateTag` をキャッシュ境界で呼ぶ
