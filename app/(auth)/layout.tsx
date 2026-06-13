// 本番 CSP nonce が per-request で変わるため、静的プリレンダではスクリプトがブロックされる。
// force-dynamic でランタイムレンダリングに固定し、proxy が付与する nonce を script に適用させる。
export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">{children}</div>
}
