'use client'

import { useState, useTransition, useRef, useId } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { deleteAccount } from '@/lib/actions/profile'
import { ACCOUNT_DELETE_CONFIRMATION } from '@/lib/constants/limits'
import { ROUTES } from '@/lib/constants/routes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const titleId = useId()
  const descriptionId = useId()
  const inputLabelId = useId()

  const isConfirmed = confirmText === ACCOUNT_DELETE_CONFIRMATION

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setConfirmText('')
      setErrorMessage(null)
    }
  }

  const handleDelete = () => {
    if (!isConfirmed) return

    startTransition(async () => {
      const result = await deleteAccount({ confirmation: confirmText })
      if (result.success) {
        // セッションをクライアント側でもクリアしてから遷移する
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push(ROUTES.LOGIN)
      } else {
        setErrorMessage('削除に失敗しました。もう一度お試しください。')
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        className="border-destructive text-destructive hover:bg-destructive/10 self-start"
        onClick={() => setOpen(true)}
        data-testid="account-delete-open-dialog"
      >
        アカウントを削除する
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          role="alertdialog"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          showCloseButton={false}
          data-testid="account-delete-dialog"
        >
          <DialogHeader>
            <DialogTitle id={titleId}>アカウントを削除しますか？</DialogTitle>
            <DialogDescription id={descriptionId}>
              この操作は取り消せません。以下がすべて削除されます:
            </DialogDescription>
          </DialogHeader>

          <ul className="text-sm text-muted-foreground flex flex-col gap-1 list-disc list-inside">
            <li>すべてのページとその内容</li>
            <li>アップロードした画像</li>
            <li>登録した AI キー（ブラウザから）</li>
            <li>アカウント情報</li>
          </ul>

          <div className="flex flex-col gap-2">
            <label id={inputLabelId} className="text-sm text-foreground">
              続けるには「{ACCOUNT_DELETE_CONFIRMATION}」と入力してください。
            </label>
            <Input
              ref={inputRef}
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value)
                setErrorMessage(null)
              }}
              placeholder={ACCOUNT_DELETE_CONFIRMATION}
              aria-labelledby={inputLabelId}
              aria-required="true"
              aria-invalid={confirmText.length > 0 && !isConfirmed}
              data-testid="account-delete-confirm-input"
              autoFocus
            />
          </div>

          {errorMessage && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={isPending} />
              }
            >
              キャンセル
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmed || isPending}
              aria-disabled={!isConfirmed || isPending}
              aria-busy={isPending}
              data-testid="account-delete-submit"
            >
              {isPending ? '削除中…' : '削除する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
