'use client'

import { useState, useTransition, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfile } from '@/lib/actions/profile'
import { MAX_DISPLAY_NAME_LENGTH } from '@/lib/constants/limits'

type ProfileFormProps = {
  initialDisplayName: string
  email: string
}

type FormError = {
  displayName?: string
  general?: string
}

export function ProfileForm({ initialDisplayName, email }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [errors, setErrors] = useState<FormError>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const inputId = useId()
  const hintId = useId()
  const errorId = useId()
  const emailId = useId()
  const emailHintId = useId()

  const validate = (): boolean => {
    const next: FormError = {}

    if (displayName.trim().length === 0) {
      next.displayName = '表示名を入力してください'
    } else if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      next.displayName = `${MAX_DISPLAY_NAME_LENGTH}文字以内で入力してください`
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage(null)

    if (!validate()) return

    startTransition(async () => {
      const result = await updateProfile({ displayName: displayName.trim() })
      if (result.success) {
        setSuccessMessage('プロフィールを保存しました')
        setErrors({})
      } else {
        setErrors({ general: '保存に失敗しました。もう一度お試しください。' })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* 表示名フィールド */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>表示名</Label>
        <Input
          id={inputId}
          data-testid="profile-display-name-input"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value)
            setSuccessMessage(null)
          }}
          placeholder="表示名を入力してください"
          aria-required="true"
          aria-describedby={`${hintId} ${errors.displayName ? errorId : ''}`}
          aria-invalid={!!errors.displayName}
          maxLength={MAX_DISPLAY_NAME_LENGTH + 10}
        />
        <p id={hintId} className="text-xs text-muted-foreground">
          {MAX_DISPLAY_NAME_LENGTH} 文字まで
        </p>
        {errors.displayName && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {errors.displayName}
          </p>
        )}
      </div>

      {/* 成功・エラーメッセージ */}
      {successMessage && (
        <p role="status" aria-live="polite" className="text-sm text-foreground font-medium">
          {successMessage}
        </p>
      )}
      {errors.general && (
        <p role="alert" className="text-sm text-destructive">
          {errors.general}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        data-testid="profile-save-button"
        className="self-start"
      >
        {isPending ? '保存中…' : '保存する'}
      </Button>

      {/* セパレータ */}
      <hr className="border-border" />

      {/* メールアドレス（変更不可） */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>メールアドレス</Label>
        <Input
          id={emailId}
          type="email"
          value={email}
          readOnly
          aria-readonly="true"
          aria-label="メールアドレス（変更不可）"
          aria-describedby={emailHintId}
          className="text-muted-foreground bg-muted/50 cursor-not-allowed"
        />
        <p id={emailHintId} className="text-xs text-muted-foreground">
          メールアドレスの変更は現在サポートされていません。
        </p>
      </div>
    </form>
  )
}
