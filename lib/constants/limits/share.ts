// 共有トークンのバイト数。crypto 乱数 24 バイト → base64url で 32 文字。
// 推測困難（192bit）でリンク漏洩以外から到達されない強度。
export const SHARE_TOKEN_BYTES = 24
// 共有の権限種別
export const SHARE_PERMISSIONS = ['view', 'edit'] as const
export type SharePermission = (typeof SHARE_PERMISSIONS)[number]
