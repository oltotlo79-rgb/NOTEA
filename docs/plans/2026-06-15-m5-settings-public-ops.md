# M5: 設定・公開・運用 実装計画（第1弾 MVP 仕上げ）

> チーム分業（PM 統括）。要件定義書 3.5 / 3.11 / 3.12 / 5.4 / 5.7 / 6.4、.claude/rules/ 準拠。

**Goal:** 設定の残り（プロフィール/使用量/アカウント削除/外観）、公開ページ（LP/ヘルプ/法務）、運用（ごみ箱 cron / ヘルスチェック）、SEO（メタデータ/noindex/sitemap）、アクセシビリティを実装し、第1弾 MVP を完成させる。

**前提（M1〜M4 完了済み）:** 認証・ページ・エディタ・画像・AI（BYOK）。profiles テーブル（plan/display_name）、admin クライアント（service_role・server-only）、getStorageUsage/getAiUsageToday/count_user_pages rpc、CRON_SECRET 環境変数。

---

## 担当・ラウンド
- Round 1（並行）: backend（profile actions・cron・health・verifyCronAuth・vercel.json）＋ designer（設定/公開/法務 UX 簡易仕様）
- Round 2: frontend（設定ページ群・テーマ・LP・ヘルプ・法務・SEO・アクセシビリティ）
- Round 3: tester（単体＋E2E: settings/public-pages/responsive/accessibility/limits）
- Round 4: evaluator（MVP 完成ゲート）

## タスク

### M5-T1（designer）: docs/design/m5-settings-public.md
設定メニュー構成（/settings ハブ＋profile/usage/account/外観）、各設定画面の項目・確認ダイアログ（アカウント削除は二段階＝確認＋テキスト入力）、外観トグル（ライト/ダーク/システム）、LP（機能紹介・料金・BYOK 説明）、/help（鍵取得手順・BYOK 注意点）、法務3ページの構成。Notion 風ミニマル。

### M5-T2（backend）
- lib/actions/profile.ts（'use server'）: getProfile（表示名・プラン）/ updateProfile（表示名変更・Zod・最大50）/ deleteAccount（admin クライアントで auth.users 削除→cascade。confirmation テキスト一致を引数で検証。requireUser 必須）。
- lib/services/usage.ts: getPageCount(userId)（count_user_pages rpc ラップ。settings/usage 用）が無ければ追加。
- app/api/cron/cleanup-trash/route.ts: Bearer CRON_SECRET 検証（verifyCronAuth）→ admin クライアントで is_trashed=true かつ trashed_at < now()-TRASH_RETENTION_DAYS のページを Storage 画像ごと完全削除。
- app/api/health/route.ts: DB 接続検証（軽いクエリ）→ 200/503。
- lib/actions/utils.ts または lib/utils: verifyCronAuth（Authorization: Bearer CRON_SECRET 比較）。
- vercel.json: cleanup-trash を毎日 00:00 UTC。
- テスト: updateProfile（未認証/Zod/正常）、deleteAccount（未認証/confirmation 不一致/正常＝admin 呼び出し確認）、cron（認証なし401/正常削除）、health。

### M5-T3（frontend）
- 設定: app/(main)/settings/page.tsx（ハブ）、settings/profile・usage・account・appearance。共通の設定レイアウト。
  - profile: 表示名編集（updateProfile）。usage: ページ数/ストレージ/本日 AI 残（getPageCount/getStorageUsage/getAiUsageToday を RSC で取得）。account: 削除（確認ダイアログ＋テキスト入力二段階→deleteAccount→/login）。appearance: テーマ切替。
- テーマ: next-themes 導入。app/layout.tsx に ThemeProvider（class 戦略）。globals.css のダーク変数確認。
- 公開: app/(public)/page.tsx（LP 本実装＝機能/料金/BYOK）、(public)/help。app/(legal)/{terms,privacy,tokushoho}。privacy に「AI キー・プロンプトを収集しない」明記。
- SEO: 公開ページに metadata（title/description/OGP）、アプリ内（pages/settings/trash）は robots noindex。app/sitemap.ts（公開のみ）、app/robots.ts。
- アクセシビリティ: スキップリンク、主要 ARIA、フォーカス可視、キーボードショートカット（新規ページ作成等）。
- 注: 法務本文は雛形（ドラフト）でよい。privacy の BYOK 記述は正確に。

### M5-T4（tester）
- 単体: profile actions（backend 作成分の補強）、設定コンポーネント、テーマ切替、cron/health。
- E2E: settings.spec（プロフィール編集・使用量表示・テーマ）、public-pages.spec（LP/法務/noindex）、responsive.spec（モバイルドロワー）、accessibility.spec（キーボード・ARIA・スキップリンク）、limits.spec（無料100ページ・AI5回到達時の挙動。プロバイダはスタブ）。
- カバレッジ閾値維持・E2E 2回連続全緑・鍵非漏洩を壊さない。

### M5-T5（evaluator）: MVP 完成ゲート
全自動ゲート＋全要件（第1弾）充足・BYOK 維持・RLS・cron/health のセキュリティ（CRON_SECRET・admin の限定使用）・noindex・アクセシビリティを判定。PASS で第1弾 MVP 完成。

## 完了条件
- 設定4画面が機能、外観切替が効く、アカウント削除が安全に動く
- LP/ヘルプ/法務が表示、公開ページに適切なメタデータ・アプリ内は noindex・sitemap は公開のみ
- cron でごみ箱30日削除・/api/health が稼働
- アクセシビリティの主要項目を満たす
- 全テスト緑・カバレッジ閾値・BYOK/RLS 維持 → 第1弾 MVP 完成
