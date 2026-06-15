import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記 | Notea',
}

const TOKUSHOHO_ITEMS: Array<{ label: string; value: string }> = [
  { label: '販売業者', value: '[事業者名]' },
  { label: '代表者', value: '[氏名]' },
  { label: '所在地', value: '[住所]' },
  { label: '電話番号', value: '[電話番号]（受付時間: 平日 10:00〜17:00）' },
  { label: 'メールアドレス', value: '[メールアドレス]' },
  { label: '販売価格', value: 'プレミアムプラン ¥300/月（税込）または ¥3,000/年（税込）' },
  { label: '支払い方法', value: 'クレジットカード（Stripe）' },
  { label: '支払い時期', value: 'サービス利用開始時' },
  { label: 'サービス提供時期', value: '決済完了後、即時' },
  {
    label: '返品・キャンセル',
    value: 'サービスの性質上、返金・キャンセルはお受けできません（解約はいつでも可能）',
  },
  { label: '動作環境', value: 'モダンブラウザ（Chrome/Firefox/Safari/Edge 最新版）' },
]

export default function TokushohoPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">最終更新日: 2026-06-15</p>

      <h1 className="text-3xl font-bold">特定商取引法に基づく表記</h1>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {TOKUSHOHO_ITEMS.map(({ label, value }) => (
              <tr key={label}>
                <th
                  scope="row"
                  className="px-4 py-3 text-left font-medium text-foreground bg-muted/30 w-40 shrink-0 align-top"
                >
                  {label}
                </th>
                <td className="px-4 py-3 text-muted-foreground">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        ※ 第2弾リリース（有料プラン）の開始に合わせて、各項目を正式な情報に更新します。
      </p>
    </div>
  )
}
