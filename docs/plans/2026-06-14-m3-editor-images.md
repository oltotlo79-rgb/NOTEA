# M3: エディタ＋画像 実装計画

> チーム分業（PM 統括）。要件定義書 3.3 / 5.2、`.claude/rules/` 準拠。TDD・各レイヤ専門エージェント担当。

**Goal:** BlockNote によるブロック型エディタを `/pages/[id]` に組み込み、debounce 自動保存（既存 `updatePageContent` を利用）と、ブラウザ圧縮（長辺2048px・WebP）→ 署名付きURL アップロードによる画像挿入を実現する。

**Architecture:** エディタと画像圧縮は性質上ブラウザ専用（`'use client'` / `lib/images/`）。BlockNote と AI プロバイダ同様、`next/dynamic`（`ssr:false`）で遅延読み込み。本文保存は既存 Server Action `updatePageContent`（M2 実装済み）を debounce で呼ぶ。画像は `lib/actions/images.ts`（署名付きURL 発行＋容量/形式チェック）経由で Supabase Storage（M1 でバケット作成済み `page-images`）へ直接アップロード。

**Tech Stack:** BlockNote（Tiptap/ProseMirror ベース）/ Next.js dynamic import / Canvas 画像圧縮 / Supabase Storage 署名付きURL

**前提（M1/M2 で完了済み）:**
- Storage バケット `page-images`（非公開・`{user_id}/...` プレフィックス RLS・WebP のみ・5MB 上限）
- `updatePageContent({id, content, contentText})` Server Action（1MB チェック込み）
- 画像系定数 `lib/constants/limits/images.ts`（MAX_IMAGE_INPUT_SIZE_MB=20 / MAX_IMAGE_STORED_SIZE_MB=5 / IMAGE_MAX_DIMENSION=2048 / IMAGE_WEBP_QUALITY=80 / FREE_MAX_STORAGE_MB=200 / PAID_MAX_STORAGE_GB=5）
- `/pages/[id]` の `PageView` は本文プレースホルダ（ここを BlockNote に差し替える）

---

## 担当・依存関係

```
designer（エディタ/画像 UX 仕様）┐
                                  ├→ frontend（compress / BlockNote / autosave / 画像挿入）→ tester（テスト）→ evaluator（ゲート）
backend（images Server Actions）  ┘
```
- Round 1（並行）: designer（UX 仕様）＋ backend（images actions + 単体テスト）
- Round 2: frontend（compress.ts / Editor / useAutosave / 画像アップロード統合）
- Round 3: tester（compress 単体 / useAutosave / 画像 action 単体は backend が作成 / エディタ・画像 E2E）
- Round 4: evaluator（受け入れゲート）

---

## タスク

### M3-T1（designer）: エディタ・画像 UX 仕様
`docs/design/m3-editor.md` に: 対応ブロック（段落/H1-3/箇条書き/番号/チェック/引用/コードブロック/区切り線/画像）、インライン装飾（太字/斜体/下線/取消線/インラインコード/リンク）、`/` コマンドメニュー、ツールバー、自動保存ステータス表示（保存中/保存済み/失敗・再試行）の配置、画像のアップロード中/失敗プレースホルダ、空ページの見え方。Notion 風ミニマル。実装はしない。

### M3-T2（backend）: 画像 Server Actions
`lib/actions/images.ts`（`'use server'`、認証→Zod→制限→ロジック→ActionResult）:
- `createUploadUrl({ pageId, contentType, sizeBytes })`: 署名付きアップロードURL発行。`contentType` は `image/webp` のみ・`sizeBytes ≤ MAX_IMAGE_STORED_SIZE_MB`・容量上限（`getStorageUsage`）チェック。パスは**サーバーで構築** `{userId}/{pageId}/{uuid}.webp`（クライアント指定パスを信用しない）。`supabase.storage.from('page-images').createSignedUploadUrl(path)`。
- `deleteImage({ path })`: パス先頭の userId 一致を検証して削除。
- `getStorageUsage()`: ユーザーの合計サイズ（バイト）取得。プラン上限と併せて残量を返す（設定画面・アップロード前チェックで使用）。
`lib/services/usage.ts` に `getStorageUsage` を置き images action と settings から共有。鍵・AI 無関係。単体テスト（未認証/Zod/容量超過/非WebP/他人パス）を伴う。

### M3-T3（frontend）: ブラウザ画像圧縮
`lib/images/compress.ts`（ブラウザ専用・Canvas/OffscreenCanvas）: `compressImage(file): Promise<Blob>` — 長辺 `IMAGE_MAX_DIMENSION` に縮小・`image/webp` 品質 `IMAGE_WEBP_QUALITY/100` に変換。入力は JPEG/PNG/WebP（GIF 非対応）・原画 `MAX_IMAGE_INPUT_SIZE_MB` まで。マジックバイト/MIME 検証。`lib/supabase/server` 等サーバーモジュールを import しない。

### M3-T4（frontend）: BlockNote エディタ + 自動保存
- `components/editor/Editor.tsx`（`'use client'`）: BlockNote を `next/dynamic`（`ssr:false`）で遅延読み込み。初期 content（`PageDetail.content`）から復元。対応ブロック・装飾・`/` メニュー。標準に無いブロック（引用/区切り線等）はカスタムブロックで補完。
- `hooks/use-autosave.ts`: debounce `AUTOSAVE_DEBOUNCE_MS`（=1500、`lib/constants/limits` に追加）で `updatePageContent` を呼ぶ。`content_text`（プレーンテキスト抽出）も同送。状態 `saving|saved|error` を返し、失敗時はローカル保持＋再試行（エラーバウンダリに投げない）。
- `components/page/PageView.tsx` のプレースホルダを `Editor` + 保存ステータス表示に差し替え。
- 画像: BlockNote の画像アップロードハンドラで `compressImage` → `createUploadUrl` → 署名URL に PUT → 公開/署名URLをブロックに設定。アップロード中/失敗の UI。
- AUTOSAVE_DEBOUNCE_MS 定数を `lib/constants/limits/`（editor.ts 新規 or pages.ts）に追加。

### M3-T5（tester）: テスト
- `lib/images/compress.ts` 単体（縮小・WebP 変換・形式拒否。Canvas はモック or jsdom）。
- `hooks/use-autosave.ts` 単体（debounce・成功/失敗・再試行。`vi.useFakeTimers`）。
- 画像 action は backend が単体作成済み。不足を補強。
- E2E: `editor.spec.ts`（ブロック入力・装飾・自動保存ステータス）、`editor-image.spec.ts`（圧縮→WebP保存・形式/サイズ/容量エラー。プロバイダ/Storage は `page.route()` でスタブ可）。BlockNote はキーボード入力ベース・`data-testid` 優先（深い DOM 依存回避）。

### M3-T6（PM/evaluator）: ゲート・統合
lint/typecheck/coverage/build/E2E 全緑、BYOK（画像経路に AI 鍵が無いこと）・Storage RLS・規約を evaluator が判定。ロードマップ更新。

## 完了条件
- `/pages/[id]` で文章・各ブロックを入力でき、1.5s debounce で自動保存され状態表示される
- 画像をブラウザ圧縮（長辺2048・WebP）して署名URLでアップロードし挿入できる。形式/サイズ/容量上限が機能する
- 全テスト緑・カバレッジ閾値・AI 鍵経路ゼロ維持
