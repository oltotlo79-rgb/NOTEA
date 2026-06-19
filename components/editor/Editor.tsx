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
import { BlockNoteViewRaw, useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems, FormattingToolbarController } from '@blocknote/react'
import type { PartialBlock } from '@blocknote/core'
import type { FormattingToolbarProps, DefaultReactSuggestionItem } from '@blocknote/react'
import { Table } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { editorSchema, DATA_TABLE_TYPE, newDataTableJson } from '@/lib/editor/schema'
import { parseTable, extractPlainText } from '@/lib/editor/data-table'
import { createUploadUrl } from '@/lib/actions/images'
import { compressImage, type CompressError } from '@/lib/images/compress'
import { ERR_IMAGE_TOO_LARGE } from '@/lib/constants/errors'
import { MAX_IMAGE_INPUT_SIZE_MB, SIGNED_URL_EXPIRES_IN } from '@/lib/constants/limits'
import { SlashMenu } from './SlashMenu'
import { AiFormattingToolbar } from './AiFormattingToolbar'

type EditorProps = {
  pageId: string
  initialContent: unknown
  onContentChange: (content: unknown[], contentText: string) => void
  /** AI 操作のコンテキスト用ページ全体テキスト（PageView から渡す） */
  pageContentText?: string
  /** 「このページに質問する」クリック時のコールバック */
  onAskPanelOpen?: () => void
  /** トースト表示用コールバック */
  onToast?: (message: string, actionLabel?: string, actionHref?: string) => void
}

function isPartialBlockArray(value: unknown): value is PartialBlock[] {
  return Array.isArray(value)
}

function isCompressError(value: unknown): value is CompressError {
  // `'kind' in value` が成立した時点で TypeScript は value を `{ kind: unknown }` に絞る
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof value.kind === 'string'
  )
}

export function Editor({ pageId, initialContent, onContentChange, pageContentText = '', onAskPanelOpen, onToast }: EditorProps) {
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
    // 表示時に resolveFileUrl が path から署名URLを生成する（期限切れ回避）。
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
      .createSignedUrl(url, SIGNED_URL_EXPIRES_IN)
    return data?.signedUrl ?? url
  }, [])

  const editor = useCreateBlockNote(
    {
      schema: editorSchema,
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
    // 標準ブロックは markdown 化、dataTable は列名・セル値を抽出して content_text に含める
    // （カスタムブロックは blocksToMarkdownLossy で拾えず検索対象から漏れるため）
    let baseText = ''
    try {
      baseText = editor.blocksToMarkdownLossy(editor.document)
    } catch {
      baseText = ''
    }
    const tableText = editor.document
      .filter((block) => block.type === DATA_TABLE_TYPE)
      .map((block) => {
        const props: Record<string, unknown> = block.props
        return extractPlainText(parseTable(typeof props.data === 'string' ? props.data : ''))
      })
      .join('\n')
    const contentText = [baseText, tableText].filter(Boolean).join('\n').trim()
    onContentChange(content, contentText)
  }, [editor, onContentChange])

  const handleInsertText = useCallback((text: string) => {
    // ページ末尾に新しいブロックとして挿入（要約・続き書き共通）
    const lastBlock = editor.document[editor.document.length - 1]
    if (lastBlock) {
      editor.insertBlocks(
        [{ type: 'paragraph', content: [{ type: 'text', text, styles: {} }] }],
        lastBlock,
        'after'
      )
    }
  }, [editor])

  const handleReplaceText = useCallback((text: string) => {
    // 選択範囲をテキストで置換（翻訳）
    editor.insertInlineContent([{ type: 'text', text, styles: {} }])
  }, [editor])

  const handleToast = useCallback(
    (message: string, actionLabel?: string, actionHref?: string) => {
      onToast?.(message, actionLabel, actionHref)
    },
    [onToast]
  )

  // FormattingToolbarController の formattingToolbar prop は FC<FormattingToolbarProps> しか受け付けないため、
  // AiFormattingToolbar の追加 props（pageContentText 等）をクロージャで束縛するラッパーを作る。
  const CustomFormattingToolbar = useCallback(
    (props: FormattingToolbarProps) => (
      <AiFormattingToolbar
        {...props}
        pageContentText={pageContentText}
        onAskPanelOpen={onAskPanelOpen ?? (() => {})}
        onInsertText={handleInsertText}
        onReplaceText={handleReplaceText}
        onToast={handleToast}
      />
    ),
    [pageContentText, onAskPanelOpen, handleInsertText, handleReplaceText, handleToast]
  )

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
        formattingToolbar={false}
      >
        <FormattingToolbarController formattingToolbar={CustomFormattingToolbar} />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const dataTableItem: DefaultReactSuggestionItem = {
              title: 'データベース',
              subtext: '型付きの表を挿入',
              aliases: ['table', 'db', '表', 'データベース', 'database'],
              group: '高度',
              icon: <Table className="size-4" />,
              onItemClick: () => {
                editor.insertBlocks(
                  [{ type: DATA_TABLE_TYPE, props: { data: newDataTableJson() } }],
                  editor.getTextCursorPosition().block,
                  'after'
                )
              },
            }
            const items = [...getDefaultReactSlashMenuItems(editor), dataTableItem]
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
