'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createPage } from '@/lib/actions/pages'
import { ROUTES } from '@/lib/constants/routes'

export function CreateFirstPageButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createPage({})
      if (result.success && result.data) {
        router.push(`${ROUTES.PAGES}/${result.data.id}`)
      }
    })
  }

  return (
    <Button onClick={handleCreate} disabled={isPending}>
      最初のページを作成
    </Button>
  )
}
