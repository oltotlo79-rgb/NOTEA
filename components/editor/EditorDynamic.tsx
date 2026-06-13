'use client'

/**
 * @module components/editor/EditorDynamic
 * BlockNote（SSR 非対応）を next/dynamic で遅延読み込みするラッパー。
 * ページ初期表示を BlockNote のバンドルサイズで遅くしないために ssr: false で読む。
 */
import dynamic from 'next/dynamic'
import { EditorSkeleton } from './EditorSkeleton'
type EditorDynamicProps = {
  pageId: string
  initialContent: unknown
  onContentChange: (content: unknown[], contentText: string) => void
}

const EditorInner = dynamic(
  () => import('./Editor').then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
)

export function EditorDynamic(props: EditorDynamicProps) {
  return <EditorInner {...props} />
}
