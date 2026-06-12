import type { Metadata } from 'next'
import { PasswordResetRequestForm } from '@/components/auth/PasswordResetRequestForm'

export const metadata: Metadata = { title: 'パスワード再設定 | Notea', robots: { index: false } }

export default function PasswordResetPage() {
  return <PasswordResetRequestForm />
}
