---
globs: "app/**/*.tsx, lib/actions/**/*.ts, lib/cache.ts"
---

# データフェッチング・キャッシュルール

## Server Componentでのデータ取得

- **直接 async/await** を使用（API Route経由しない）
- 複数データは **Promise.all** で並列取得

```typescript
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [page, children] = await Promise.all([getPage(id), getChildPages(id)])
  return <PageEditorShell page={page} childPages={children} />
}
```

## キャッシュ戦略

| 方法 | スコープ | 用途 |
|------|---------|------|
| `cache()` (React) | 同一リクエスト内 | 同じデータの重複取得防止（例: layout と page 双方で使うページツリー） |
| `unstable_cache()` | リクエスト間 | 頻繁にアクセスされる共通データ |
| `revalidatePath()` | ページ単位 | データ変更後のキャッシュ更新 |
| `revalidateTag()` | タグ単位 | 特定データのキャッシュ無効化 |

注意: ユーザー固有データ（ページ・ツリー）を `unstable_cache` でキャッシュする場合は
**キーに userId を含める**こと。含めないと他ユーザーのデータが混ざる。

```typescript
export const getCachedPageTree = (userId: string) => unstable_cache(
  async () => fetchPageTree(userId),
  ['page-tree', userId],
  { revalidate: 60, tags: [`page-tree-${userId}`] }
)()
```

## エディタの自動保存とサーバー状態

- エディタ本文の自動保存は **debounce + Server Action**（`hooks/useAutosave`）
- 保存中・保存済み・失敗の状態を UI に出す。失敗時は再試行できること
- React Query を使う場合、ページツリーは `['page-tree']` キーで管理し、
  作成・削除・移動の mutation 後に invalidate する

## Streaming と Suspense

- 重いデータ取得を `<Suspense>` でラップして段階的に表示
- `loading.tsx` はページ全体のフォールバック

```typescript
<Suspense fallback={<PageTreeSkeleton />}>
  <PageTree />  {/* async Server Component */}
</Suspense>
```
