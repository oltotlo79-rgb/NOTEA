import { FileText, Sparkles, FolderTree } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const FEATURES = [
  {
    icon: FileText,
    title: 'ブロックエディタ',
    description: '見出し・リスト・コード・画像など、Notion 風のリッチな編集環境',
  },
  {
    icon: Sparkles,
    title: 'BYOK AI',
    description: 'Gemini・OpenAI・Anthropic を自分のキーで使える。Notea に費用の上乗せなし',
  },
  {
    icon: FolderTree,
    title: 'ページツリー',
    description: 'ネストした階層でドキュメントを整理。モバイルでも快適に使える',
  },
]

export function FeatureCards() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="size-6 text-primary mb-2" aria-hidden="true" />
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
