'use client'

/**
 * @module components/editor/AiFormattingToolbar
 * 標準書式ボタン + AI ボタンを統合したカスタム FormattingToolbar。
 */

import { useCallback, useState } from 'react'
import {
  FormattingToolbar,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useEditorSelectionChange,
} from '@blocknote/react'
import type { FormattingToolbarProps } from '@blocknote/react'
import { Separator } from '@/components/ui/separator'
import { AiMenu } from '@/components/ai/AiMenu'

type AiFormattingToolbarProps = FormattingToolbarProps & {
  /** AI 操作のコンテキスト用ページ全体テキスト */
  pageContentText: string
  /** 「このページに質問する」クリック時のコールバック */
  onAskPanelOpen: () => void
  /** トースト表示用コールバック */
  onToast: (message: string, actionLabel?: string, actionHref?: string) => void
  /** 要約・続き書きの結果をページ末尾に挿入する */
  onInsertText: (text: string) => void
  /** 翻訳の結果で選択範囲を置換する */
  onReplaceText: (text: string) => void
}

export function AiFormattingToolbar({
  pageContentText,
  onAskPanelOpen,
  onToast,
  onInsertText,
  onReplaceText,
  ...toolbarProps
}: AiFormattingToolbarProps) {
  const editor = useBlockNoteEditor()
  const [selectedText, setSelectedText] = useState('')

  const handleSelectionChange = useCallback(() => {
    const text = window.getSelection()?.toString() ?? ''
    setSelectedText(text)
  }, [])

  useEditorSelectionChange(handleSelectionChange, editor)

  return (
    <FormattingToolbar {...toolbarProps}>
      {getFormattingToolbarItems()}
      <Separator orientation="vertical" className="mx-1 h-5" />
      <AiMenu
        pageContentText={pageContentText}
        selectedText={selectedText}
        onAskPanelOpen={onAskPanelOpen}
        onInsertText={onInsertText}
        onReplaceText={onReplaceText}
        onToast={onToast}
        variant="toolbar"
      />
    </FormattingToolbar>
  )
}
