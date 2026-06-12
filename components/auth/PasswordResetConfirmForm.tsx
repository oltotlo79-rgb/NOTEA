'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword } from '@/lib/actions/auth'
import { ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { ROUTES } from '@/lib/constants/routes'
import { passwordUpdateSchema } from '@/lib/validations/auth'

export function PasswordResetConfirmForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = passwordUpdateSchema.safeParse({ password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? ERR_INVALID_INPUT)
      return
    }
    startTransition(async () => {
      const result = await updatePassword(parsed.data)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push(ROUTES.PAGES)
      router.refresh()
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>新しいパスワード</CardTitle>
        <CardDescription>新しいパスワードを設定してください</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">新しいパスワード</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              8文字以上で、英字と数字をそれぞれ1文字以上含めてください
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? '更新中…' : 'パスワードを更新'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
