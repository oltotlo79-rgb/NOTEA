'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn } from '@/lib/actions/auth'
import { ROUTES } from '@/lib/constants/routes'
import { sanitizeInternalPath } from '@/lib/utils/auth-redirect'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await signIn({ email, password })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push(sanitizeInternalPath(searchParams.get('redirectTo')) ?? ROUTES.PAGES)
      router.refresh()
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>ログイン</CardTitle>
        <CardDescription>Notea へようこそ</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'ログイン中…' : 'ログイン'}
          </Button>
        </form>
        <GoogleSignInButton />
        <div className="space-y-1 text-center text-sm text-muted-foreground">
          <p>
            <Link href={ROUTES.PASSWORD_RESET} className="underline underline-offset-4">
              パスワードをお忘れですか？
            </Link>
          </p>
          <p>
            アカウントをお持ちでない方は{' '}
            <Link href={ROUTES.REGISTER} className="underline underline-offset-4">
              新規登録
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
