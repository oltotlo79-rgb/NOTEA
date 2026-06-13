import type { Metadata } from 'next'
import { TrashView } from '@/components/trash/TrashView'

export const metadata: Metadata = {
  title: 'ごみ箱 | Notea',
  robots: { index: false, follow: false },
}

export default function TrashPage() {
  return (
    <div className="h-full">
      <div className="px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold">ごみ箱</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          削除されたページはここに表示されます
        </p>
      </div>
      <TrashView />
    </div>
  )
}
