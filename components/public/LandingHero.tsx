import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'

export function LandingHero() {
  return (
    <section className="py-24 text-center flex flex-col items-center gap-6 px-4">
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-2xl">
        思考を整理する、新しいメモ体験
      </h1>
      <p className="text-xl text-muted-foreground max-w-xl">
        Notion 風のブロックエディタ × あなた自身の AI で。
      </p>
      <p className="text-sm text-muted-foreground max-w-lg">
        AI の費用はあなたが直接プロバイダに支払うだけ。Notea は鍵を預からないから、安心して使えます。
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Button render={<Link href={ROUTES.REGISTER} data-testid="lp-cta-register" />}>
          無料で始める
        </Button>
        <Button variant="outline" render={<Link href={ROUTES.LOGIN} data-testid="lp-cta-login" />}>
          ログイン
        </Button>
      </div>
    </section>
  )
}
