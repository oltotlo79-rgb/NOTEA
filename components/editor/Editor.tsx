'use client'

/**
 * @module components/editor/Editor
 * BlockNote ブロック型エディタのメインコンポーネント。
 * next/dynamic（ssr: false）でラップして使用すること。
 * Supabase Storage への画像アップロードは uploadFile ハンドラ経由で実施し、
 * content には path のみを保存（署名URLを保存しない）。
 */
import '@blocknote/react/style.css'
import { useCallback } from 'react'
import { BlockNoteViewRaw, useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react'
import type { PartialBlock, Block, DefaultBlockSchema, DefaultInlineContentSchema, DefaultStyleSchema } from '@blocknote/core'
import { createClient } from '@/lib/supabase/client'
import { createUploadUrl } from '@/lib/actions/images'
import { compressImage, type CompressError } from '@/lib/images/compress'
import { ERR_IMAGE_TOO_LARGE } from '@/lib/constants/errors'
import { MAX_IMAGE_INPUT_SIZE_MB } from '@/lib/constants/limits'
import { SlashMenu } from './SlashMenu'

type EditorProps = {
  pageId: string
  initialContent: unknown
  onContentChange: (content: unknown[], contentText: string) => void
}

function isPartialBlockArray(value: unknown): value is PartialBlock[] {
  return Array.isArray(value)
}

function isCompressError(value: unknown): value is CompressError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as Record<string, unknown>)['kind'] === 'string'
  )
}

/**
 * ブロック配列からプレーンテキストを抽出する。
 * BlockNote の blocksToMarkdownLossy はサーバーでも動くが、
 * ここではクライアント側のエディタ状態から取得するためブラウザ専用。
 */
type DefaultEditor = ReturnType<typeof useCreateBlockNote>

function extractText(editor: DefaultEditor): string {
  try {
    return editor.document
      .map((block: Block<DefaultBlockSchema, DefaultInlineContentSchema, DefaultStyleSchema>) =>
        editor.blocksToMarkdownLossy([block])
      )
      .join('\n')
      .trim()
  } catch {
    return ''
  }
}

export function Editor({ pageId, initialContent, onContentChange }: EditorProps) {
  // initialContent はマウント時の一度だけ使うため変数に確定する（deps で空配列を渡すことで再初期化しない）
  // 空配列は BlockNote が拒否して "Error creating document from blocks" を throw するため
  // undefined にしてデフォルトの空段落を使わせる
  const initialBlockContent =
    isPartialBlockArray(initialContent) && initialContent.length > 0 ? initialContent : undefined

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    let blob: Blob
    try {
      blob = await compressImage(file)
    } catch (e: unknown) {
      if (isCompressError(e)) {
        if (e.kind === 'unsupported_type') {
          throw new Error('この形式の画像はサポートされていません（JPEG/PNG/WebP のみ）')
        }
        if (e.kind === 'input_too_large') {
          throw new Error(ERR_IMAGE_TOO_LARGE(MAX_IMAGE_INPUT_SIZE_MB))
        }
      }
      throw new Error('画像の圧縮に失敗しました')
    }

    const result = await createUploadUrl({
      pageId,
      contentType: 'image/webp',
      sizeBytes: blob.size,
    })

    if (!result.success) {
      throw new Error(result.error)
    }

    if (!result.data) {
      throw new Error('アップロードURLの取得に失敗しました')
    }

    const { signedUrl, path } = result.data

    const uploadResponse = await fetch(signedUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'image/webp' },
    })

    if (!uploadResponse.ok) {
      throw new Error('アップロードに失敗しました。ネットワーク状態を確認して再試行してください。')
    }

    // 署名URLではなく storage path を返す。
    // 表示時に useImageUrl フックが path から署名URLを生成する（期限切れ回避）。
    return path
  }, [pageId])

  const resolveFileUrl = useCallback(async (url: string): Promise<string> => {
    // http から始まる URL（外部 or 古い署名URL）はそのまま返す
    if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url
    }
    // Storage path → 署名付き閲覧URL を生成
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('page-images')
      .createSignedUrl(url, 3600)
    return data?.signedUrl ?? url
  }, [])

  const editor = useCreateBlockNote(
    {
      initialContent: initialBlockContent,
      uploadFile,
      resolveFileUrl,
      defaultStyles: false,
    },
    []
  )

  const handleChange = useCallback(() => {
    // editor.document の型 Block[] は unknown[] に安全に変換できる（ダウングレード）
    const content: unknown[] = editor.document
    const contentText = extractText(editor)
    onContentChange(content, contentText)
  }, [editor, onContentChange])

  return (
    <div
      data-testid="editor-root"
      className="mt-2 px-8 md:px-[72px] pb-24"
      aria-label="ページ本文"
    >
      <BlockNoteViewRaw
        editor={editor}
        theme="light"
        onChange={handleChange}
        slashMenu={false}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const items = getDefaultReactSlashMenuItems(editor)
            if (!query) return items
            const lowerQuery = query.toLowerCase()
            return items.filter(
              (item) =>
                item.title.toLowerCase().includes(lowerQuery) ||
                item.aliases?.some((a) => a.toLowerCase().includes(lowerQuery))
            )
          }}
          suggestionMenuComponent={SlashMenu}
        />
      </BlockNoteViewRaw>
    </div>
  )
}
