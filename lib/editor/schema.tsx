'use client'

/**
 * @module lib/editor/schema
 * BlockNote のスキーマ拡張。標準ブロックに加えてカスタムの dataTable（データベース表）を登録する。
 * Editor / SharedEditor の双方が同じスキーマを使う（共有ページでも表が描画できるように）。
 */
import { createReactBlockSpec } from '@blocknote/react'
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'
import { createEmptyTable, serializeTable } from '@/lib/editor/data-table'
import { DataTableBlock } from '@/components/editor/blocks/DataTableBlock'

export const DATA_TABLE_TYPE = 'dataTable'

/** 新規挿入用の空テーブル JSON（毎回ユニークな列・行 ID を持つ） */
export function newDataTableJson(): string {
  return serializeTable(createEmptyTable())
}

// createReactBlockSpec はファクトリ関数を返すため、末尾の () で呼び出して BlockSpec を得る（BlockNote 0.51）。
const dataTableBlockSpec = createReactBlockSpec(
  {
    type: DATA_TABLE_TYPE,
    propSchema: { data: { default: '' } },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <DataTableBlock
        data={block.props.data || newDataTableJson()}
        editable={editor.isEditable}
        onChange={(data) =>
          editor.updateBlock(block, { type: DATA_TABLE_TYPE, props: { data } })
        }
      />
    ),
  }
)()

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    [DATA_TABLE_TYPE]: dataTableBlockSpec,
  },
})
