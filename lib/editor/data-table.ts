/**
 * @module lib/editor/data-table
 * データベース表ブロックのデータモデルと純粋操作。
 * BlockNote のカスタムブロック props（string）に JSON 文字列として保存する表データを扱う。
 * 副作用なし・ブラウザ/サーバー中立（単体テストの主対象）。
 */

export const COLUMN_TYPES = ['text', 'number', 'checkbox', 'select', 'date'] as const
export type ColumnType = (typeof COLUMN_TYPES)[number]

export type CellValue = string | number | boolean | null

export type Column = {
  id: string
  name: string
  type: ColumnType
  options?: string[]
}

export type Row = {
  id: string
  cells: Record<string, CellValue>
}

export type DataTable = {
  columns: Column[]
  rows: Row[]
}

export const COLUMN_TYPE_LABEL: Record<ColumnType, string> = {
  text: 'テキスト',
  number: '数値',
  checkbox: 'チェック',
  select: '選択肢',
  date: '日付',
}

function genId(): string {
  // ブラウザ/jsdom 双方で利用可能。表内の行・列の一意キー用。
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // フォールバック（型安全のため。通常到達しない）
  return `id-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export function defaultCellValue(type: ColumnType): CellValue {
  switch (type) {
    case 'number':
      return null
    case 'checkbox':
      return false
    case 'text':
    case 'select':
    case 'date':
      return ''
  }
}

/** 任意の値を列の型に合わせて変換する（型変更・セル入力の正規化に使う） */
export function coerceValue(value: CellValue, type: ColumnType): CellValue {
  switch (type) {
    case 'text':
      if (typeof value === 'string') return value
      if (typeof value === 'number') return String(value)
      return ''
    case 'select':
      return typeof value === 'string' ? value : ''
    case 'date':
      // YYYY-MM-DD 形式のみ受け入れる。それ以外は空。
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
    case 'number':
      if (typeof value === 'number') return Number.isFinite(value) ? value : null
      if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value)
        return Number.isFinite(n) ? n : null
      }
      return null
    case 'checkbox':
      return value === true || value === 'true'
  }
}

export function createEmptyTable(): DataTable {
  const col: Column = { id: genId(), name: '名前', type: 'text' }
  return {
    columns: [col],
    rows: [{ id: genId(), cells: { [col.id]: '' } }],
  }
}

export function addColumn(table: DataTable, type: ColumnType, name: string): DataTable {
  const column: Column = {
    id: genId(),
    name,
    type,
    ...(type === 'select' ? { options: [] } : {}),
  }
  return {
    columns: [...table.columns, column],
    rows: table.rows.map((row) => ({
      ...row,
      cells: { ...row.cells, [column.id]: defaultCellValue(type) },
    })),
  }
}

export function removeColumn(table: DataTable, columnId: string): DataTable {
  return {
    columns: table.columns.filter((c) => c.id !== columnId),
    rows: table.rows.map((row) => {
      const cells = { ...row.cells }
      delete cells[columnId]
      return { ...row, cells }
    }),
  }
}

export function renameColumn(table: DataTable, columnId: string, name: string): DataTable {
  return {
    ...table,
    columns: table.columns.map((c) => (c.id === columnId ? { ...c, name } : c)),
  }
}

export function changeColumnType(
  table: DataTable,
  columnId: string,
  type: ColumnType
): DataTable {
  return {
    columns: table.columns.map((c) =>
      c.id === columnId
        ? { ...c, type, ...(type === 'select' ? { options: c.options ?? [] } : { options: undefined }) }
        : c
    ),
    rows: table.rows.map((row) => ({
      ...row,
      cells: { ...row.cells, [columnId]: coerceValue(row.cells[columnId] ?? null, type) },
    })),
  }
}

export function setColumnOptions(
  table: DataTable,
  columnId: string,
  options: string[]
): DataTable {
  return {
    ...table,
    columns: table.columns.map((c) => (c.id === columnId ? { ...c, options } : c)),
  }
}

export function addRow(table: DataTable): DataTable {
  const cells: Record<string, CellValue> = {}
  for (const col of table.columns) cells[col.id] = defaultCellValue(col.type)
  return { ...table, rows: [...table.rows, { id: genId(), cells }] }
}

export function removeRow(table: DataTable, rowId: string): DataTable {
  return { ...table, rows: table.rows.filter((r) => r.id !== rowId) }
}

export function setCell(
  table: DataTable,
  rowId: string,
  columnId: string,
  value: CellValue
): DataTable {
  const column = table.columns.find((c) => c.id === columnId)
  if (!column) return table
  const normalized = coerceValue(value, column.type)
  return {
    ...table,
    rows: table.rows.map((row) =>
      row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: normalized } } : row
    ),
  }
}

function isColumnType(value: unknown): value is ColumnType {
  return typeof value === 'string' && (COLUMN_TYPES as readonly string[]).includes(value)
}

function isCellValue(value: unknown): value is CellValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

/** JSON 文字列を安全に DataTable に変換する。不正なら空テーブルを返す（クラッシュさせない）。 */
export function parseTable(json: string): DataTable {
  try {
    const raw: unknown = JSON.parse(json)
    if (typeof raw !== 'object' || raw === null) return createEmptyTable()
    const obj = raw as Record<string, unknown>
    if (!Array.isArray(obj.columns) || !Array.isArray(obj.rows)) return createEmptyTable()

    const columns: Column[] = []
    for (const c of obj.columns) {
      if (typeof c !== 'object' || c === null) continue
      const col = c as Record<string, unknown>
      if (typeof col.id !== 'string' || typeof col.name !== 'string' || !isColumnType(col.type)) continue
      const options = Array.isArray(col.options)
        ? col.options.filter((o): o is string => typeof o === 'string')
        : undefined
      columns.push({ id: col.id, name: col.name, type: col.type, ...(options ? { options } : {}) })
    }

    const rows: Row[] = []
    for (const r of obj.rows) {
      if (typeof r !== 'object' || r === null) continue
      const row = r as Record<string, unknown>
      if (typeof row.id !== 'string' || typeof row.cells !== 'object' || row.cells === null) continue
      const cells: Record<string, CellValue> = {}
      for (const [k, v] of Object.entries(row.cells as Record<string, unknown>)) {
        if (isCellValue(v)) cells[k] = v
      }
      rows.push({ id: row.id, cells })
    }

    if (columns.length === 0) return createEmptyTable()
    return { columns, rows }
  } catch {
    return createEmptyTable()
  }
}

export function serializeTable(table: DataTable): string {
  return JSON.stringify(table)
}

/** 列名と文字列セル値を連結して返す（content_text 抽出 = 全文検索用）。 */
export function extractPlainText(table: DataTable): string {
  const parts: string[] = table.columns.map((c) => c.name)
  for (const row of table.rows) {
    for (const col of table.columns) {
      const v = row.cells[col.id]
      if (typeof v === 'string' && v) parts.push(v)
      else if (typeof v === 'number') parts.push(String(v))
    }
  }
  return parts.join(' ')
}
