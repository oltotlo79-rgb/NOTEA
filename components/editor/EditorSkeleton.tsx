import { Skeleton } from '@/components/ui/skeleton'

// ローディング中の行スケルトン幅（% 値。Notion 風にランダムな幅）
const SKELETON_LINES = [
  'w-full',
  'w-4/5',
  'w-3/4',
  'w-full',
  'w-2/3',
  'w-5/6',
] as const

export function EditorSkeleton() {
  return (
    <div className="px-8 md:px-[72px] mt-2 space-y-3" aria-label="エディタ読み込み中">
      {SKELETON_LINES.map((widthClass, i) => (
        <Skeleton key={i} className={`h-4 ${widthClass}`} />
      ))}
    </div>
  )
}
