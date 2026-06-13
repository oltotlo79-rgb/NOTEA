import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { AppShell } from '@/components/layout/AppShell'
import { ROUTES } from '@/lib/constants/routes'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // middleware が守るルートだが多層防御のため確認する
  if (!user) {
    redirect(ROUTES.LOGIN)
  }

  return (
    <QueryProvider>
      <AppShell userEmail={user.email}>
        {children}
      </AppShell>
    </QueryProvider>
  )
}
