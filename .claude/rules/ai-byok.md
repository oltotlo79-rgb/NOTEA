---
globs: "lib/ai/**/*.ts, components/ai/**/*.tsx, app/api/ai/**/*.ts, lib/services/usage.ts"
---

# AI 機能・API キー取り扱いルール（BYOK — セキュリティの肝）

このアプリの根幹仕様: **AI の API キーはユーザー自身のもので、ブラウザにのみ保存される。
アプリのサーバー・DB は鍵を一切持たない。** この前提を壊す変更は、どんなに便利でも禁止。

## 絶対ルール

1. **鍵を DB・サーバーログ・Sentry・analytics に保存・送信・記録しない**
2. **鍵を cookie に入れない**（cookie は毎リクエスト自動的にサーバーへ送られるため、
   「ブラウザ保存」の建前が崩れる）
3. **鍵を URL クエリに入れない**（アクセスログ・履歴・Referer に残る）
4. **Server Action の引数に鍵を含めない** — 引数型に `apiKey` 等のフィールドを定義した時点で違反
5. **AI のプロンプト・応答をサーバーに保存しない** — サーバーが記録してよいのは
   「ユーザーID・日付・プロバイダ・使用回数」だけ
6. 鍵の保存・読み出しは `lib/ai/key-storage.ts` 経由のみ（localStorage 直叩き禁止。
   保存箇所を1ファイルに集約して監査可能にする）

## アーキテクチャ

```
[ブラウザ]
  lib/ai/key-storage.ts   ← localStorage に provider 別で保存
  lib/ai/providers/*.ts   ← fetch でプロバイダ API を直接呼ぶ
        │ ①回数消費 (鍵は送らない)          │ ②AI呼び出し (鍵はここだけ)
        ▼                                    ▼
[アプリサーバー]                       [AI プロバイダ]
  consumeAiUsage() Server Action        Gemini / OpenAI / Anthropic
  └─ ai_usage テーブルを atomic increment
```

## 利用フロー（必須順序）

1. Client Component が `consumeAiUsage(provider)` **Server Action** を呼ぶ
   - サーバー側: 認証 → プラン判定（無料は Gemini のみ・1日5回 / 有料は1日100回）→
     `ai_usage` をアトミックに increment（上限超過なら increment せずエラー）
2. 成功したらブラウザが `lib/ai/providers/{provider}.ts` でプロバイダ API を直接呼ぶ
3. 結果はブラウザ内でエディタに反映。サーバーには送らない

回数チェックを後置きにしない（呼んでから数えると上限を超えられる）。

## プロバイダ別の接続方式

| プロバイダ | ブラウザ直接呼び出し | 備考 |
|-----------|-------------------|------|
| Gemini | 可 | CORS 対応。無料プランはこれのみ |
| Anthropic | 可 | `anthropic-dangerous-direct-browser-access: true` ヘッダが必要 |
| OpenAI | 不可（CORS 非対応） | `app/api/ai/proxy/route.ts` のパススルー経由 |

### パススルールートの厳守事項（鍵が一瞬サーバーを通る唯一の例外）

- 鍵は `Authorization` ヘッダで受け、転送後に**破棄**。変数に保持してログ・例外メッセージに含めない
- `Cache-Control: no-store`。リクエスト/レスポンスボディを記録しない
- 認証済みユーザーのみ + 転送前に `consumeAiUsage()` 消費
- 転送先はプロバイダ公式ドメインの **allowlist** のみ（任意 URL 転送 = SSRF 禁止）

## key-storage.ts の仕様

- 保存: `localStorage`、キー名は `lib/constants/` の定数（例: `notea_ai_key_gemini`）
- 提供 API: `getKey(provider)` / `setKey(provider, key)` / `removeKey(provider)` / `hasKey(provider)`
- UI 表示は末尾4文字のみ（`sk-...abcd`）。入力欄は `type="password"`
- 登録時に軽い形式チェック + プロバイダへのテスト呼び出しで検証
- 端末ごとに別保存になる仕様はユーザー合意済み。「PC とスマホで別々に入力が必要」と設定画面に明記する

## プラン制御

- 無料プラン: 登録できるのは Gemini キーのみ。OpenAI / Anthropic の入力 UI は
  有料プランでのみ表示（サーバー側 `consumeAiUsage` でも provider を検証する。UI 出し分けだけに頼らない）
- 回数・対象プロバイダの定数は `lib/constants/limits/ai.ts`

## エラーと監視

- プロバイダのエラーはブラウザ内で処理し、ユーザーに「鍵が無効 / 上限超過 / ネットワーク」を区別して表示
- Sentry に送ってよいのはエラー種別・プロバイダ名まで。鍵・プロンプト・応答本文は送らない

## テスト観点

- `consumeAiUsage`: 未認証 / 無料で OpenAI 指定 / 上限ちょうど / 上限超過 / 日付切り替わり
- `key-storage`: set→get / remove / 不正形式の拒否
- パススルー: 未認証 401 / allowlist 外 403 / 鍵がレスポンス・ログに含まれない
