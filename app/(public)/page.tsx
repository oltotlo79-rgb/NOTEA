import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Notea</h1>
      <p className="max-w-md text-muted-foreground">
        Notion 風のメモ・ドキュメントアプリ。AI はあなた自身の API キーで動くから、安心して使えます。
      </p>
      <div className="flex gap-3">
        <Button render={<Link href={ROUTES.REGISTER} />}>無料で始める</Button>
        <Button variant="outline" render={<Link href={ROUTES.LOGIN} />}>
          ログイン
        </Button>
      </div>
    </main>
  )
}
