'use client'

/**
 * @module components/editor/blocks/DataTableBlock
 * データベース表ブロックの描画・編集 UI。
 * data（JSON 文字列）と onChange だけに依存する純粋な React コンポーネントにして、
 * BlockNote 非依存で単体テストできるようにする（schema.ts が editor と配線する）。
 */
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  parseTable,
  serializeTable,
  addColumn,
  removeColumn,
  renameColumn,
  changeColumnType,
  setColumnOptions,
  addRow,
  removeRow,
  setCell,
  COLUMN_TYPES,
  COLUMN_TYPE_LABEL,
  type DataTable,
  type Column,
  type CellValue,
} from '@/lib/editor/data-table'

type DataTableBlockProps = {
  data: string
  editable: boolean
  onChange: (data: string) => void
}

export function DataTableBlock({ data, editable, onChange }: DataTableBlockProps) {
  const table = parseTable(data)
  const update = (next: DataTable) => onChange(serializeTable(next))

  return (
    <div className="my-2 w-full overflow-x-auto" data-testid="data-table-block">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {table.columns.map((col) => (
              <th key={col.id} className="border border-border bg-muted/40 p-1 align-top text-left font-medium">
                <ColumnHeader
                  column={col}
                  editable={editable}
                  onRename={(name) => update(renameColumn(table, col.id, name))}
                  onChangeType={(type) => update(changeColumnType(table, col.id, type))}
                  onSetOptions={(opts) => update(setColumnOptions(table, col.id, opts))}
                  onRemove={() => update(removeColumn(table, col.id))}
                />
              </th>
            ))}
            {editable && (
              <th className="border border-border bg-muted/40 p-1 w-8">
                <button
                  type="button"
                  onClick={() => update(addColumn(table, 'text', `列${table.columns.length + 1}`))}
                  aria-label="列を追加"
                  className="flex items-center justify-center rounded p-1 hover:bg-muted"
                >
                  <Plus className="size-4" />
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              {table.columns.map((col) => (
                <td key={col.id} className="border border-border p-1 align-top">
                  <CellEditor
                    column={col}
                    value={row.cells[col.id] ?? null}
                    editable={editable}
                    onChange={(v) => update(setCell(table, row.id, col.id, v))}
                  />
                </td>
              ))}
              {editable && (
                <td className="border border-border p-1 text-center">
                  <button
                    type="button"
                    onClick={() => update(removeRow(table, row.id))}
                    aria-label="行を削除"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {editable && (
        <button
          type="button"
          onClick={() => update(addRow(table))}
          className="mt-1 flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          <Plus className="size-3.5" />
          行を追加
        </button>
      )}
    </div>
  )
}

type ColumnHeaderProps = {
  column: Column
  editable: boolean
  onRename: (name: string) => void
  onChangeType: (type: Column['type']) => void
  onSetOptions: (options: string[]) => void
  onRemove: () => void
}

function ColumnHeader({ column, editable, onRename, onChangeType, onSetOptions, onRemove }: ColumnHeaderProps) {
  if (!editable) {
    return <span className="px-1">{column.name}</span>
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          value={column.name}
          onChange={(e) => onRename(e.target.value)}
          aria-label={`列名 ${column.name}`}
          className="min-w-0 flex-1 bg-transparent px-1 py-0.5 outline-none focus:bg-background rounded"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`列「${column.name}」を削除`}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
      <select
        value={column.type}
        onChange={(e) => onChangeType(e.target.value as Column['type'])}
        aria-label={`列「${column.name}」の型`}
        className="rounded border border-border bg-background px-1 py-0.5 text-xs"
      >
        {COLUMN_TYPES.map((t) => (
          <option key={t} value={t}>
            {COLUMN_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      {column.type === 'select' && (
        <input
          value={(column.options ?? []).join(',')}
          onChange={(e) =>
            onSetOptions(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
            )
          }
          placeholder="選択肢（カンマ区切り）"
          aria-label={`列「${column.name}」の選択肢`}
          className="rounded border border-border bg-background px-1 py-0.5 text-xs"
        />
      )}
    </div>
  )
}

type CellEditorProps = {
  column: Column
  value: CellValue
  editable: boolean
  onChange: (value: CellValue) => void
}

function CellEditor({ column, value, editable, onChange }: CellEditorProps) {
  // テキスト/数値はローカル state で編集しカーソルジャンプを防ぐ（blur/Enter で確定）。
  const [local, setLocal] = useState<string | null>(null)

  if (!editable) {
    return <span className="px-1">{formatCellText(column, value)}</span>
  }

  switch (column.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={`${column.name} のチェック`}
          className="size-4"
        />
      )
    case 'select':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${column.name} の選択`}
          className="w-full bg-transparent px-1 py-0.5 outline-none"
        >
          <option value="">—</option>
          {(column.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    case 'date':
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${column.name} の日付`}
          className="w-full bg-transparent px-1 py-0.5 outline-none"
        />
      )
    case 'number':
    case 'text': {
      const display = local ?? (value === null ? '' : String(value))
      return (
        <input
          type={column.type === 'number' ? 'number' : 'text'}
          value={display}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            if (local !== null) {
              onChange(local)
              setLocal(null)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          aria-label={`${column.name} の入力`}
          className="w-full bg-transparent px-1 py-0.5 outline-none"
        />
      )
    }
  }
}

function formatCellText(column: Column, value: CellValue): string {
  if (column.type === 'checkbox') return value === true ? '☑' : '☐'
  if (value === null) return ''
  return String(value)
}
