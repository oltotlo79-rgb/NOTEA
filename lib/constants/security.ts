// CSP connect-src と AI パススルー（/api/ai/proxy）の転送先 allowlist で共用する。
// ここに無いオリジンへ鍵が送られない構造を CSP 自体が保証する（BYOK の防衛線）
export const AI_PROVIDER_API_ORIGINS: readonly string[] = [
  'https://generativelanguage.googleapis.com',
  'https://api.openai.com',
  'https://api.anthropic.com',
]
