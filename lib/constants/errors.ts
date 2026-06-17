export const ERR_AUTH_REQUIRED = 'ログインが必要です'
export const ERR_INVALID_INPUT = '入力内容が正しくありません'
export const ERR_DB = 'データの読み書きに失敗しました。時間をおいて再試行してください'
export const ERR_PAID_REQUIRED = 'この機能は有料プランでのみ利用できます'
export const ERR_LOGIN_FAILED = 'メールアドレスまたはパスワードが正しくありません'
export const ERR_SIGNUP_FAILED = 'アカウント登録に失敗しました。時間をおいて再試行してください'
export const ERR_PASSWORD_UPDATE_FAILED =
  'パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります'
export const ERR_PAGE_LIMIT_REACHED = (max: number) =>
  `ページ数の上限（${max}ページ）に達しました。不要なページを削除するか、プレミアムプランをご検討ください`
export const ERR_PAGE_NOT_FOUND = 'ページが見つかりません'
export const ERR_PAGE_CONTENT_TOO_LARGE = 'ページの内容が大きすぎます（上限1MB）'
export const ERR_PAGE_CIRCULAR = 'ページを自身の子孫の下へは移動できません'
export const ERR_PAGE_DEPTH_LIMIT = 'ページの階層が深すぎます（最大10階層）'
export const ERR_STORAGE_LIMIT_REACHED = (limitLabel: string) =>
  `ストレージ容量の上限（${limitLabel}）に達しました。不要な画像を削除するか、プレミアムプランをご検討ください`
export const ERR_INVALID_IMAGE_TYPE = '画像は WebP 形式のみアップロードできます'
export const ERR_IMAGE_TOO_LARGE = (maxMb: number) =>
  `画像サイズが上限（${maxMb}MB）を超えています`
export const ERR_IMAGE_PATH_FORBIDDEN = '他のユーザーの画像は削除できません'
export const ERR_AI_PROVIDER_NOT_ALLOWED =
  'このプロバイダは有料プランでのみ利用できます。無料プランでは Gemini のみ使用可能です'
export const ERR_AI_LIMIT_REACHED = (limit: number) =>
  `AI の利用回数が本日の上限（${limit}回）に達しました。明日（JST 0時以降）再度ご利用ください`
export const ERR_AI_FAILED = 'AI の処理に失敗しました。時間をおいて再試行してください'
export const ERR_AI_PROXY_FORBIDDEN = '転送先が許可されていません'

export const ERR_AI_KEY_INVALID =
  'API キーが無効です。設定から再登録してください。'
export const ERR_AI_KEY_NOT_FOUND =
  'AI を使うには API キーの登録が必要です。設定から Gemini などのキーを登録してください。'
export const ERR_AI_KEY_FORMAT = 'キーの形式が正しくありません'
export const ERR_AI_DAILY_LIMIT_FREE = (limit: number) =>
  `本日の AI 利用回数（${limit}回）に達しました。明日 0 時（JST）にリセットされます。`
export const ERR_AI_DAILY_LIMIT_PAID = (limit: number) =>
  `本日の AI 利用回数（${limit}回）に達しました。明日 0 時（JST）にリセットされます。`
export const ERR_AI_NETWORK =
  '通信エラーが発生しました。ネットワーク状態を確認して再試行してください。'
export const ERR_AI_RATE_LIMITED =
  '現在 API のリクエストが多すぎます。しばらく待ってから再試行してください。'
export const ERR_AI_EMPTY_CONTENT =
  'ページに本文がありません。テキストを入力してから操作してください。'

export const ERR_PROFILE_NOT_FOUND = 'プロフィールが見つかりません'
export const ERR_PROFILE_UPDATE_FAILED = 'プロフィールの更新に失敗しました。時間をおいて再試行してください'
export const ERR_ACCOUNT_DELETE_CONFIRMATION =
  'アカウント削除の確認テキストが一致しません。もう一度入力してください'
export const ERR_ACCOUNT_DELETE_FAILED =
  'アカウントの削除に失敗しました。時間をおいて再試行してください'
export const ERR_SHARE_NOT_FOUND = '共有リンクが見つからないか、無効になっています'
export const ERR_SHARE_CREATE_FAILED = '共有リンクの発行に失敗しました。時間をおいて再試行してください'
export const ERR_SHARE_REVOKE_FAILED = '共有リンクの失効に失敗しました。時間をおいて再試行してください'
export const ERR_SHARE_EDIT_LOGIN_REQUIRED = '編集するにはログインが必要です'

export const ERR_CRON_UNAUTHORIZED = 'Unauthorized'
export const ERR_CRON_DB_FETCH = 'DB fetch failed'
export const ERR_CRON_DB_DELETE = 'DB delete failed'
