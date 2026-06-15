import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '利用規約 | Notea',
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">最終更新日: 2026-06-15</p>

      <h1 className="text-3xl font-bold">利用規約</h1>

      <section className="flex flex-col gap-4 text-sm leading-relaxed text-foreground">
        <h2 className="text-xl font-semibold mt-8 mb-3">1. はじめに</h2>
        <p>
          本利用規約（以下「本規約」）は、Notea（以下「当サービス」）の利用条件を定めるものです。
          ユーザーの皆様には、本規約に従って当サービスをご利用いただきます。
          当サービスをご利用になった場合、本規約に同意したものとみなします。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. サービスの内容</h2>
        <p>
          当サービスは、ブロック型エディタによるメモ・ドキュメント作成機能、および BYOK（Bring Your Own Key）方式による
          AI 機能を提供します。AI 機能はユーザーご自身が取得した API キーを使用します。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. アカウントの登録</h2>
        <p>
          当サービスを利用するには、メールアドレスまたは Google アカウントによる登録が必要です。
          登録情報は正確・最新の状態に保つことをお願いします。
          アカウントの管理はユーザー自身の責任で行ってください。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. 禁止事項</h2>
        <p>以下の行為を禁止します:</p>
        <ul className="list-disc list-inside flex flex-col gap-1 text-muted-foreground ml-4">
          <li>法令または公序良俗に違反する行為</li>
          <li>当サービスの運営を妨害する行為</li>
          <li>他のユーザーまたは第三者の権利を侵害する行為</li>
          <li>当サービスを不正な目的で利用する行為</li>
          <li>虚偽の情報を登録する行為</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. データの取り扱い</h2>
        <p>
          当サービスにおけるデータの取り扱いについては、プライバシーポリシーをご確認ください。
          特に AI の API キー・プロンプト・応答は当サービスのサーバーに保存されません。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">6. サービスの変更・停止</h2>
        <p>
          当サービスは、ユーザーへの事前通知なく、サービスの内容を変更し、
          または提供を停止することがあります。これによって生じた損害について、
          当サービスは責任を負いません。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">7. 免責事項</h2>
        <p>
          当サービスは現状有姿で提供されます。当サービスの利用に起因する
          直接・間接の損害について、当サービスは責任を負いません。
          AI 機能は外部プロバイダの API を使用するため、その可用性・品質について
          当サービスは保証できません。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">8. 準拠法・管轄裁判所</h2>
        <p>
          本規約は日本法に準拠します。本規約に関する紛争については、
          東京地方裁判所を専属的合意管轄裁判所とします。
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">9. お問い合わせ</h2>
        <p>
          本規約に関するお問い合わせは、サービス内のサポート窓口にてお受けします。
        </p>
      </section>
    </div>
  )
}
