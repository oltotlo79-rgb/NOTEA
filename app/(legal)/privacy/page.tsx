import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'プライバシーポリシー | Notea',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">最終更新日: 2026-06-15</p>

      <h1 className="text-3xl font-bold">プライバシーポリシー</h1>

      <section className="flex flex-col gap-4 text-sm leading-relaxed text-foreground">
        <h2 className="text-xl font-semibold mt-8 mb-3">1. 収集する情報</h2>

        <h3 className="text-base font-semibold mt-4 mb-2">1-1. アカウント情報</h3>
        <p>
          ユーザー登録時に、メールアドレスを収集します。
          Google OAuth でご登録の場合は、Google から提供されるメールアドレスおよびプロフィール情報を取得します。
        </p>

        <h3 className="text-base font-semibold mt-4 mb-2">1-2. コンテンツ</h3>
        <p>
          ユーザーが作成したページの内容（テキスト・画像）は、Supabase が管理する
          データベース・ストレージに保存されます。これらはユーザーの認証情報に紐づき、
          RLS（Row Level Security）によって保護されます。
        </p>

        <h3 className="text-base font-semibold mt-4 mb-2">1-3. 利用情報</h3>
        <p>
          AI 機能の利用回数（プロバイダ・日付・回数）をサーバーに記録します。
          これは無料・有料プランの制限管理のために使用されます。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. 収集しない情報（重要）</h2>

        <div className="bg-muted/50 border border-border rounded-lg p-4 flex flex-col gap-3">
          <p className="font-medium text-foreground">以下の情報は収集しません:</p>

          <div className="flex flex-col gap-3">
            <div>
              <p className="font-medium">AI の API キー</p>
              <p className="text-muted-foreground mt-1">
                ユーザーのブラウザの localStorage にのみ保存され、
                Notea のサーバーには送信・保存されません。
                仮に当サービスのサーバーへの不正アクセスがあっても、API キーは漏洩しません。
              </p>
            </div>

            <div>
              <p className="font-medium">AI へのプロンプト（入力テキスト）</p>
              <p className="text-muted-foreground mt-1">
                ブラウザから直接 AI プロバイダに送信されます。
                Notea のサーバーには通過・記録されません。
              </p>
            </div>

            <div>
              <p className="font-medium">AI の応答内容</p>
              <p className="text-muted-foreground mt-1">
                AI プロバイダからブラウザに直接返されます。
                Notea のサーバーに保存されません。
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. 情報の利用目的</h2>
        <p>収集した情報は以下の目的で利用します:</p>
        <ul className="list-disc list-inside flex flex-col gap-1 text-muted-foreground ml-4">
          <li>サービスの提供・維持・改善</li>
          <li>プランに基づく機能制限の管理</li>
          <li>不正利用の防止</li>
          <li>ユーザーサポート</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. 第三者への提供</h2>
        <p>
          当サービスはユーザーの個人情報を第三者に販売・提供しません。
          ただし、以下の場合を除きます:
        </p>
        <ul className="list-disc list-inside flex flex-col gap-1 text-muted-foreground ml-4">
          <li>ユーザーの同意がある場合</li>
          <li>法令に基づく場合</li>
          <li>サービス提供に必要な業務委託先（Supabase 等）への提供</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. Cookie の使用</h2>
        <p>
          当サービスはセッション管理のために Cookie を使用します。
          API キーは Cookie には保存されません（ブラウザの localStorage に保存されます）。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">6. セキュリティ</h2>
        <p>
          当サービスは適切な技術的・組織的措置によりデータを保護します。
          ただし、インターネット上での完全な安全性を保証することはできません。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">7. お子様のプライバシー</h2>
        <p>
          当サービスは 13 歳未満の方を対象としていません。
          13 歳未満の方が誤って登録された場合は、速やかにアカウントを削除します。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">8. お問い合わせ</h2>
        <p>
          プライバシーに関するお問い合わせは、サービス内のサポート窓口にてお受けします。
        </p>
      </section>
    </div>
  )
}
