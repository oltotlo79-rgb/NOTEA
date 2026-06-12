import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/constants/routes'

export const metadata: Metadata = {
  title: '確認メールを送信しました | Notea',
  robots: { index: false },
}

export default function VerifyEmailSentPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>確認メールを送信しました</CardTitle>
        <CardDescription>登録はまだ完了していません</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          メール内のリンクをクリックして登録を完了してください。
          届かない場合は迷惑メールフォルダをご確認ください。
        </p>
        <p className="text-center text-muted-foreground">
          <Link href={ROUTES.LOGIN} className="underline underline-offset-4">
            ログインに戻る
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
