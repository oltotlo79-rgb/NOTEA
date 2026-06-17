'use client'

/**
 * @module components/share/SharedEditor
 * 共有ページ用の BlockNote エディタ。閲覧（editable=false）と
 * ログイン編集（editable=true）の両方に使う。
 *
 * 所有者用 Editor と分離する理由: 所有者用は画像アップロード（owner Storage 前提）と
 * AI ツールバーに密結合しており、共有では使えないため。画像表示は token 検証つきの
 * getSharedImageUrl 経由で署名 URL を解決する（匿名でも閲覧できるように）。
 * 共有編集では新規画像アップロードは未対応（owner プレフィックス RLS のため）。
 */
import '@blocknote/react/style.css'
import { useCallback } from 'react'
import { BlockNoteViewRaw, useCreateBlockNote } from '@blocknote/react'
import type { PartialBlock } from '@blocknote/core'
import { getSharedImageUrl } from '@/lib/actions/shared-pages'

type SharedEditorProps = {
  token: string
  initialContent: unknown
  editable: boolean
  onContentChange?: (content: unknown[], contentText: string) => void
}

function isPartialBlockArray(value: unknown): value is PartialBlock[] {
  return Array.isArray(value)
}

export function SharedEditor({ token, initialContent, editable, onContentChange }: SharedEditorProps) {
  const initialBlockContent =
    isPartialBlockArray(initialContent) && initialContent.length > 0 ? initialContent : undefined

  const resolveFileUrl = useCallback(
    async (url: string): Promise<string> => {
      if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) {
        return url
      }
      const result = await getSharedImageUrl({ token, path: url })
      return result.url ?? url
    },
    [token]
  )

  const editor = useCreateBlockNote(
    {
      initialContent: initialBlockContent,
      resolveFileUrl,
      defaultStyles: false,
    },
    []
  )

  const handleChange = useCallback(() => {
    if (!onContentChange) return
    const content: unknown[] = editor.document
    const contentText = editor.document
      .map((block) => editor.blocksToMarkdownLossy([block]))
      .join('\n')
      .trim()
    onContentChange(content, contentText)
  }, [editor, onContentChange])

  return (
    <div
      data-testid="shared-editor-root"
      className="mt-2 px-8 md:px-[72px] pb-24"
      aria-label="共有ページ本文"
    >
      <BlockNoteViewRaw
        editor={editor}
        editable={editable}
        theme="light"
        onChange={editable ? handleChange : undefined}
        slashMenu={false}
        formattingToolbar={editable}
      />
    </div>
  )
}
