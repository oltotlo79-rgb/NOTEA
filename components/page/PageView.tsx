'use client'

import { PageHeader } from './PageHeader'
import type { PageDetail } from '@/lib/queries/pages'

type PageViewProps = {
  page: PageDetail
}

export function PageView({ page }: PageViewProps) {
  return (
    <div className="flex flex-col h-full">
      <PageHeader pageId={page.id} title={page.title} icon={page.icon} />
      <div className="flex-1 px-8 py-4">
        <p className="text-sm text-muted-foreground">
          エディタは次のアップデートで利用可能になります
        </p>
      </div>
    </div>
  )
}
