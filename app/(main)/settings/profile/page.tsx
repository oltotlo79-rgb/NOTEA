import type { Metadata } from 'next'
import Link from 'next/link'
import { getProfile } from '@/lib/actions/profile'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = {
  title: 'プロフィール | Notea',
  robots: { index: false },
}

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profileResult = await getProfile()
  const displayName = profileResult.success ? (profileResult.data?.displayName ?? '') : ''

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* モバイル: 戻るリンク */}
      <div className="flex items-center gap-3 md:hidden">
        <Link
          href={ROUTES.SETTINGS}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← 設定
        </Link>
      </div>

      <h1 className="text-2xl font-bold">プロフィール</h1>

      <ProfileForm
        initialDisplayName={displayName}
        email={user?.email ?? ''}
      />
    </div>
  )
}
