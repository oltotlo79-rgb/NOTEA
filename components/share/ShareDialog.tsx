'use client'

import { useCallback, useState } from 'react'
import { Check, Copy, Link2, Share2 } from 'lucide-react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createShare, revokeShare, listShares } from '@/lib/actions/shares'
import { ROUTES } from '@/lib/constants/routes'
import type { SharePermission } from '@/lib/constants/limits'

type ShareDialogProps = {
  pageId: string
}

function shareUrl(token: string): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  return `${origin}${ROUTES.SHARE}/${token}`
}

export function ShareDialog({ pageId }: ShareDialogProps) {
  const [open, setOpen] = useState(false)
  const [tokens, setTokens] = useState<Record<SharePermission, string | null>>({
    view: null,
    edit: null,
  })
  const [pendingPermission, setPendingPermission] = useState<SharePermission | null>(null)

  const refresh = useCallback(async () => {
    const result = await listShares({ pageId })
    const next: Record<SharePermission, string | null> = { view: null, edit: null }
    for (const share of result.data) next[share.permission] = share.token
    setTokens(next)
  }, [pageId])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    // 開いたタイミングで現在の共有状態を取得する（effect 内 setState を避ける）
    if (next) void refresh()
  }

  const handleCreate = async (permission: SharePermission) => {
    setPendingPermission(permission)
    const result = await createShare({ pageId, permission })
    if (result.success && result.data) {
      setTokens((prev) => ({ ...prev, [permission]: result.data!.token }))
    }
    setPendingPermission(null)
  }

  const handleRevoke = async (permission: SharePermission) => {
    setPendingPermission(permission)
    const result = await revokeShare({ pageId, permission })
    if (result.success) {
      setTokens((prev) => ({ ...prev, [permission]: null }))
    }
    setPendingPermission(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" aria-label="共有" className="gap-1.5 text-muted-foreground">
            <Share2 className="size-4" />
            共有
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>このページを共有</DialogTitle>
          <DialogDescription>
            リンクを知っている人がアクセスできます。編集リンクはログインが必要です。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <ShareRow
            label="閲覧のみ"
            description="リンクを知っている人が読めます（ログイン不要）"
            token={tokens.view}
            isPending={pendingPermission === 'view'}
            onCreate={() => handleCreate('view')}
            onRevoke={() => handleRevoke('view')}
          />
          <ShareRow
            label="編集可"
            description="ログインしたユーザーが編集できます"
            token={tokens.edit}
            isPending={pendingPermission === 'edit'}
            onCreate={() => handleCreate('edit')}
            onRevoke={() => handleRevoke('edit')}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

type ShareRowProps = {
  label: string
  description: string
  token: string | null
  isPending: boolean
  onCreate: () => void
  onRevoke: () => void
}

function ShareRow({ label, description, token, isPending, onCreate, onRevoke }: ShareRowProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(shareUrl(token))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボード API が使えない環境では何もしない（手動コピー可能）
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {token ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevoke}
            disabled={isPending}
            className="shrink-0 text-destructive hover:text-destructive"
          >
            失効
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onCreate}
            disabled={isPending}
            className="shrink-0 gap-1.5"
          >
            <Link2 className="size-4" />
            リンクを発行
          </Button>
        )}
      </div>

      {token && (
        <div className="flex items-center gap-2">
          <Input readOnly value={shareUrl(token)} aria-label={`${label}の共有リンク`} className="text-xs" />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleCopy}
            aria-label="リンクをコピー"
            className="shrink-0"
          >
            {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
          </Button>
        </div>
      )}
    </div>
  )
}
