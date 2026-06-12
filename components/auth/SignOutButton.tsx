'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/actions/auth'
import { ROUTES } from '@/lib/constants/routes'

export function SignOutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = () =>
    startTransition(async () => {
      await signOut()
      router.push(ROUTES.LOGIN)
      router.refresh()
    })

  return (
    <Button variant="ghost" disabled={isPending} onClick={handleClick}>
      ログアウト
    </Button>
  )
}
