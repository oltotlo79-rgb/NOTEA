import { requireEnv } from '@/lib/utils/env'

/**
 * Vercel Cron のリクエストを Bearer CRON_SECRET で検証する。
 * Authorization ヘッダが無い・一致しない場合は false を返す。
 */
export function verifyCronAuth(request: Request): boolean {
  const secret = requireEnv(process.env.CRON_SECRET, 'CRON_SECRET')
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return false
  const [scheme, token] = authHeader.split(' ')
  return scheme === 'Bearer' && token === secret
}
