---
globs: "app/**/error.tsx, app/**/not-found.tsx, app/global-error.tsx"
---

# エラーハンドリングルール

## error.tsx

- **`'use client'` 必須**
- `reset` 関数で再試行可能
- 共通の `PageError` コンポーネント（`components/common/PageError.tsx`）を使用
- `PageError` は自動的に Sentry にエラーを送信
  - **例外**: AI 機能のエラーは Sentry にプロンプト・鍵・応答を送らない
    （`.claude/rules/ai-byok.md` 参照。エラー種別のみ送信）

```typescript
'use client'
import { PageError } from '@/components/common/PageError'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <PageError error={error} reset={reset} title="読み込みに失敗しました" />
}
```

## not-found.tsx

- `notFound()` 関数と連携
- 存在しないページ ID・他人のページ（RLS で0件になる）はどちらも `notFound()` に流す
  （「存在しない」と「権限がない」を区別させない）

```typescript
import { notFound } from 'next/navigation'

export default async function Page({ params }) {
  const page = await getPage(id)
  if (!page) notFound()  // → not-found.tsx を表示
}
```

## global-error.tsx

- ルートレイアウトのエラーをキャッチ（最終防衛線）
- `<html>` と `<body>` を含める必要がある

## 階層

```
global-error.tsx → app/(main)/error.tsx → app/(main)/pages/[id]/error.tsx
```

上位のバウンダリが下位でキャッチされなかったエラーを処理する。

## 自動保存の失敗

- エディタの自動保存失敗はエラーバウンダリに投げない（ページ全体が落ちると編集中の内容を失う）
- トースト + ステータス表示で通知し、ローカルの編集内容を保持したまま再試行する
