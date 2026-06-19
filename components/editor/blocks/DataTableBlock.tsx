'use client'

/**
 * @module components/editor/blocks/DataTableBlock
 * データベース表ブロックの描画・編集 UI。テーブル / ボード / カレンダーの3ビュー。
 * data（JSON 文字列）と onChange だけに依存する純粋な React コンポーネントにして、
 * BlockNote 非依存で単体テストできるようにする（schema.tsx が editor と配線する）。
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
  addRowWith,
  removeRow,
  setCell,
  setView,
  setBoardColumn,
  setDateColumn,
  groupRowsByColumn,
  groupRowsByDate,
  titleColumnId,
  COLUMN_TYPES,
  COLUMN_TYPE_LABEL,
  VIEW_TYPES,
  VIEW_LABEL,
  BOARD_UNSET_KEY,
  type DataTable,
  type Column,
  type CellValue,
  type ViewType,
} from '@/lib/editor/data-table'

type DataTableBlockProps = {
  data: string
  editable: boolean
  onChange: (data: string) => void
}

export function DataTableBlock({ data, editable, onChange }: DataTableBlockProps) {
  const table = parseTable(data)
  const update = (next: DataTable) => onChange(serializeTable(next))
  const view: ViewType = table.view ?? 'table'

  return (
    <div className="my-2 w-full" data-testid="data-table-block">
      {editable && (
        <div className="mb-2 flex gap-1" role="tablist" aria-label="表示の切り替え">
          {VIEW_TYPES.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => update(setView(table, v))}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                view === v ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      )}

      {view === 'table' && <TableView table={table} editable={editable} update={update} />}
      {view === 'board' && <BoardView table={table} editable={editable} update={update} />}
      {view === 'calendar' && <CalendarView table={table} editable={editable} update={update} />}
    </div>
  )
}

type ViewProps = {
  table: DataTable
  editable: boolean
  update: (next: DataTable) => void
}

// ============================ テーブル表示 ============================

function TableView({ table, editable, update }: ViewProps) {
  return (
    <div className="w-full overflow-x-auto">
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

// ============================ ボード表示 ============================

function BoardView({ table, editable, update }: ViewProps) {
  const selectColumns = table.columns.filter((c) => c.type === 'select')
  const boardColumnId =
    table.boardColumnId && selectColumns.some((c) => c.id === table.boardColumnId)
      ? table.boardColumnId
      : selectColumns[0]?.id
  const titleId = titleColumnId(table)
  const titleCol = table.columns.find((c) => c.id === titleId)

  if (!boardColumnId) {
    return (
      <p className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
        ボード表示には「選択肢」型の列が必要です。テーブル表示で列の型を「選択肢」にしてください。
      </p>
    )
  }

  const lanes = groupRowsByColumn(table, boardColumnId)

  return (
    <div className="flex flex-col gap-2">
      {editable && selectColumns.length > 1 && (
        <label className="text-xs text-muted-foreground">
          グループ化する列:{' '}
          <select
            value={boardColumnId}
            onChange={(e) => update(setBoardColumn(table, e.target.value))}
            aria-label="グループ化する列"
            className="rounded border border-border bg-background px-1 py-0.5 text-xs"
          >
            {selectColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {lanes.map((lane) => (
          <div key={lane.key} className="flex w-48 shrink-0 flex-col gap-2 rounded-md bg-muted/30 p-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span>{lane.label}</span>
              <span className="text-muted-foreground">{lane.rows.length}</span>
            </div>
            {lane.rows.map((row) => (
              <div key={row.id} className="rounded border border-border bg-background p-2 text-sm">
                {titleCol && (
                  <CellEditor
                    column={titleCol}
                    value={row.cells[titleCol.id] ?? null}
                    editable={editable}
                    onChange={(v) => update(setCell(table, row.id, titleCol.id, v))}
                  />
                )}
                {editable && (
                  <select
                    value={lane.key === BOARD_UNSET_KEY ? '' : lane.key}
                    onChange={(e) => update(setCell(table, row.id, boardColumnId, e.target.value))}
                    aria-label="レーンを変更"
                    className="mt-1 w-full rounded border border-border bg-background px-1 py-0.5 text-xs"
                  >
                    <option value="">未設定</option>
                    {(table.columns.find((c) => c.id === boardColumnId)?.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
            {editable && (
              <button
                type="button"
                onClick={() =>
                  update(addRowWith(table, lane.key === BOARD_UNSET_KEY ? {} : { [boardColumnId]: lane.key }))
                }
                className="flex items-center gap-1 rounded px-1 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                <Plus className="size-3" />
                カードを追加
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================ カレンダー表示 ============================

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function CalendarView({ table, editable, update }: ViewProps) {
  const dateColumns = table.columns.filter((c) => c.type === 'date')
  const dateColumnId =
    table.dateColumnId && dateColumns.some((c) => c.id === table.dateColumnId)
      ? table.dateColumnId
      : dateColumns[0]?.id
  const titleId = titleColumnId(table)

  const today = new Date()
  const [ym, setYm] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  })

  if (!dateColumnId) {
    return (
      <p className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
        カレンダー表示には「日付」型の列が必要です。テーブル表示で列の型を「日付」にしてください。
      </p>
    )
  }

  const byDate = groupRowsByDate(table, dateColumnId)
  const firstDay = new Date(ym.year, ym.month, 1).getDay()
  const daysInMonth = new Date(ym.year, ym.month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const prev = () =>
    setYm(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }))
  const next = () =>
    setYm(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }))

  return (
    <div className="flex flex-col gap-2">
      {editable && dateColumns.length > 1 && (
        <label className="text-xs text-muted-foreground">
          日付の列:{' '}
          <select
            value={dateColumnId}
            onChange={(e) => update(setDateColumn(table, e.target.value))}
            aria-label="日付の列"
            className="rounded border border-border bg-background px-1 py-0.5 text-xs"
          >
            {dateColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={prev} aria-label="前の月" className="rounded px-2 py-1 text-sm hover:bg-muted">
          ‹
        </button>
        <span className="text-sm font-medium" data-testid="calendar-title">
          {ym.year}年{ym.month + 1}月
        </span>
        <button type="button" onClick={next} aria-label="次の月" className="rounded px-2 py-1 text-sm hover:bg-muted">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded border border-border bg-border text-xs">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-muted/40 p-1 text-center font-medium">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} className="min-h-16 bg-background" />
          const dateStr = `${ym.year}-${pad2(ym.month + 1)}-${pad2(day)}`
          const rows = byDate.get(dateStr) ?? []
          return (
            <div key={dateStr} className="min-h-16 bg-background p-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{day}</span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => update(addRowWith(table, { [dateColumnId]: dateStr }))}
                    aria-label={`${day}日に追加`}
                    className="rounded p-0.5 hover:bg-muted"
                  >
                    <Plus className="size-3" />
                  </button>
                )}
              </div>
              <div className="mt-0.5 flex flex-col gap-0.5">
                {rows.map((row) => {
                  const title = titleId ? row.cells[titleId] : null
                  return (
                    <div key={row.id} className="truncate rounded bg-primary/10 px-1 py-0.5 text-[11px]">
                      {typeof title === 'string' && title ? title : '（無題）'}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================ 共通セル ============================

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
