---
globs: "app/**/*.tsx, components/**/*.tsx, next.config.ts"
---

# パフォーマンス最適化ルール

## Image最適化

- **必ず `next/image` を使用**（自動WebP変換、遅延読み込み）
- LCP画像には `priority` を付与
- 外部画像（Supabase Storage）は `next.config.ts` の `remotePatterns` で許可

```typescript
import Image from 'next/image'

<Image src={url} alt="説明" width={600} height={400}
  sizes="(max-width: 768px) 100vw, 600px" />
```

## Dynamic Import

- 重いライブラリは `next/dynamic` で遅延読み込み
- SSR不要なコンポーネント（**BlockNote エディタ**等）は `ssr: false`

```typescript
import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('@/components/editor/Editor'), {
  ssr: false,
  loading: () => <EditorSkeleton />
})
```

- AI プロバイダ SDK（`lib/ai/providers/*`）は AI 機能を開いたときに初めて
  ロードされるよう dynamic import する（エディタ初期表示を重くしない）

## React Cache

```typescript
import { cache } from 'react'

// 同一リクエスト内でメモ化（layout と page の双方で呼んでも1回）
export const getPage = cache(async (id: string) => {
  const supabase = await createClient()
  return supabase.from('pages').select(PAGE_DETAIL_SELECT).eq('id', id).single()
})
```

## memo

- 親の状態更新が頻繁なコンポーネントでは `React.memo` で不要な再レンダリング防止
- 純粋な表示コンポーネント（アイコン、ツリーの行等）に有効
- エディタの入力ごとにサイドバー全体が再レンダリングされないよう、
  エディタ状態とツリー状態を分離する

## 画像アップロード圧縮

- 画像は **アップロード前にブラウザ側で圧縮**する（`lib/images/compress.ts`）:
  長辺 2048px に縮小 + WebP 品質 80 に変換。保存形式は WebP 統一
- サーバー側（Sharp 等）で処理しない — 署名付きURL直接アップロード設計と
  Vercel のリクエストボディ 4.5MB 制限のため
- 受付は原画 20MB まで、保存は圧縮後 5MB まで（定数は `lib/constants/limits/`）

## 自動保存

- 入力のたびに保存しない。debounce（目安: 800ms〜2s）でまとめる
- 保存ペイロードはページ単位の JSON（ブロック全体）。差分保存は第1弾では不要
