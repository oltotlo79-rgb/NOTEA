import type { Metadata } from 'next'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'ページ | Notea', robots: { index: false } }

export default async function PagesHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted-foreground">{user?.email} でログイン中</p>
      <p>まだページがありません</p>
      <SignOutButton />
    </main>
  )
}
