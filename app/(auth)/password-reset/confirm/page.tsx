import type { Metadata } from 'next'
import { PasswordResetConfirmForm } from '@/components/auth/PasswordResetConfirmForm'

export const metadata: Metadata = {
  title: '新しいパスワードの設定 | Notea',
  robots: { index: false },
}

export default function PasswordResetConfirmPage() {
  return <PasswordResetConfirmForm />
}
