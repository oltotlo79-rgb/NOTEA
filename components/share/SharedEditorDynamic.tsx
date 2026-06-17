'use client'

/**
 * @module components/share/SharedEditorDynamic
 * 共有エディタ（BlockNote, SSR 非対応）を next/dynamic で遅延読み込みするラッパー。
 */
import dynamic from 'next/dynamic'
import { EditorSkeleton } from '@/components/editor/EditorSkeleton'

type SharedEditorDynamicProps = {
  token: string
  initialContent: unknown
  editable: boolean
  onContentChange?: (content: unknown[], contentText: string) => void
}

const SharedEditorInner = dynamic(
  () => import('./SharedEditor').then((mod) => mod.SharedEditor),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
)

export function SharedEditorDynamic(props: SharedEditorDynamicProps) {
  return <SharedEditorInner {...props} />
}
