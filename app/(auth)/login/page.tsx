import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'ログイン | Notea', robots: { index: false } }

export default function LoginPage() {
  // LoginForm が useSearchParams を使うため Suspense 必須
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
