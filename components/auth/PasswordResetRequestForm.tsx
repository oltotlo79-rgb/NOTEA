'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordReset } from '@/lib/actions/auth'
import { ROUTES } from '@/lib/constants/routes'

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await requestPasswordReset({ email })
      if (!result.success) {
        setError(result.error)
        return
      }
      setSent(true)
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>パスワード再設定</CardTitle>
        <CardDescription>登録済みのメールアドレスに再設定リンクを送ります</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <p className="text-sm">
            メールを送信しました。受信トレイ（迷惑メールフォルダも）をご確認ください。
          </p>
        ) : (
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
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? '送信中…' : '再設定メールを送る'}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href={ROUTES.LOGIN} className="underline underline-offset-4">
            ログインに戻る
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
