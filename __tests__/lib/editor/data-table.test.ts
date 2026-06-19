import { describe, expect, it } from 'vitest'
import {
  createEmptyTable,
  addColumn,
  removeColumn,
  renameColumn,
  changeColumnType,
  setColumnOptions,
  addRow,
  removeRow,
  setCell,
  coerceValue,
  defaultCellValue,
  parseTable,
  serializeTable,
  extractPlainText,
} from '@/lib/editor/data-table'

describe('createEmptyTable', () => {
  it('列1・行1で初期化される', () => {
    const t = createEmptyTable()
    expect(t.columns).toHaveLength(1)
    expect(t.rows).toHaveLength(1)
    expect(t.columns[0]!.type).toBe('text')
  })
})

describe('defaultCellValue', () => {
  it('型ごとの初期値', () => {
    expect(defaultCellValue('text')).toBe('')
    expect(defaultCellValue('number')).toBeNull()
    expect(defaultCellValue('checkbox')).toBe(false)
    expect(defaultCellValue('select')).toBe('')
    expect(defaultCellValue('date')).toBe('')
  })
})

describe('coerceValue', () => {
  it('number: 文字列→数値、不正→null', () => {
    expect(coerceValue('42', 'number')).toBe(42)
    expect(coerceValue('abc', 'number')).toBeNull()
    expect(coerceValue('', 'number')).toBeNull()
    expect(coerceValue(3.5, 'number')).toBe(3.5)
  })
  it('checkbox: true/"true" のみ true', () => {
    expect(coerceValue(true, 'checkbox')).toBe(true)
    expect(coerceValue('true', 'checkbox')).toBe(true)
    expect(coerceValue('false', 'checkbox')).toBe(false)
    expect(coerceValue(0, 'checkbox')).toBe(false)
  })
  it('text: 数値→文字列', () => {
    expect(coerceValue(7, 'text')).toBe('7')
    expect(coerceValue('hi', 'text')).toBe('hi')
    expect(coerceValue(true, 'text')).toBe('')
  })
  it('date: YYYY-MM-DD のみ許可', () => {
    expect(coerceValue('2026-06-19', 'date')).toBe('2026-06-19')
    expect(coerceValue('2026/06/19', 'date')).toBe('')
    expect(coerceValue(123, 'date')).toBe('')
  })
  it('select: 文字列のみ', () => {
    expect(coerceValue('A', 'select')).toBe('A')
    expect(coerceValue(1, 'select')).toBe('')
  })
})

describe('列操作', () => {
  it('addColumn は全行にデフォルトセルを追加する', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'number', '数量')
    expect(t.columns).toHaveLength(2)
    const newCol = t.columns[1]!
    expect(newCol.name).toBe('数量')
    expect(t.rows[0]!.cells[newCol.id]).toBeNull()
  })

  it('select 列は options を持つ', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'select', '状態')
    expect(t.columns[1]!.options).toEqual([])
    t = setColumnOptions(t, t.columns[1]!.id, ['未', '済'])
    expect(t.columns[1]!.options).toEqual(['未', '済'])
  })

  it('removeColumn は列とセルを消す', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'number', '数量')
    const colId = t.columns[1]!.id
    t = removeColumn(t, colId)
    expect(t.columns).toHaveLength(1)
    expect(t.rows[0]!.cells[colId]).toBeUndefined()
  })

  it('renameColumn', () => {
    let t = createEmptyTable()
    t = renameColumn(t, t.columns[0]!.id, 'タイトル')
    expect(t.columns[0]!.name).toBe('タイトル')
  })

  it('changeColumnType は既存セル値を新型へ変換する', () => {
    let t = createEmptyTable()
    const colId = t.columns[0]!.id
    t = setCell(t, t.rows[0]!.id, colId, '99')
    t = changeColumnType(t, colId, 'number')
    expect(t.columns[0]!.type).toBe('number')
    expect(t.rows[0]!.cells[colId]).toBe(99)
  })

  it('changeColumnType で select にすると options が付く', () => {
    let t = createEmptyTable()
    t = changeColumnType(t, t.columns[0]!.id, 'select')
    expect(t.columns[0]!.options).toEqual([])
  })
})

describe('行操作', () => {
  it('addRow は全列のデフォルトセルを持つ行を追加', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'checkbox', '完了')
    t = addRow(t)
    expect(t.rows).toHaveLength(2)
    const cb = t.columns[1]!
    expect(t.rows[1]!.cells[cb.id]).toBe(false)
  })

  it('removeRow', () => {
    let t = createEmptyTable()
    t = addRow(t)
    const rowId = t.rows[0]!.id
    t = removeRow(t, rowId)
    expect(t.rows).toHaveLength(1)
    expect(t.rows.find((r) => r.id === rowId)).toBeUndefined()
  })

  it('setCell は列型に正規化して保存する', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'number', '数量')
    const colId = t.columns[1]!.id
    t = setCell(t, t.rows[0]!.id, colId, '12')
    expect(t.rows[0]!.cells[colId]).toBe(12)
  })

  it('存在しない列への setCell は無視', () => {
    const t = createEmptyTable()
    const result = setCell(t, t.rows[0]!.id, 'nope', 'x')
    expect(result).toEqual(t)
  })
})

describe('parse / serialize', () => {
  it('round-trip で保持される', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'number', '数量')
    t = setCell(t, t.rows[0]!.id, t.columns[1]!.id, 5)
    const restored = parseTable(serializeTable(t))
    expect(restored).toEqual(t)
  })

  it('不正 JSON は空テーブルにフォールバック', () => {
    const t = parseTable('not json{')
    expect(t.columns).toHaveLength(1)
    expect(t.rows).toHaveLength(1)
  })

  it('columns/rows が配列でない場合も空テーブル', () => {
    expect(parseTable('{"columns":"x","rows":1}').columns).toHaveLength(1)
  })

  it('不正な列・セルは取り除く', () => {
    const json = JSON.stringify({
      columns: [
        { id: 'c1', name: 'A', type: 'text' },
        { id: 'c2', name: 'B', type: 'invalid' },
        { name: 'noId', type: 'text' },
      ],
      rows: [{ id: 'r1', cells: { c1: 'hello', c2: { bad: 1 } } }],
    })
    const t = parseTable(json)
    expect(t.columns).toHaveLength(1)
    expect(t.columns[0]!.id).toBe('c1')
    expect(t.rows[0]!.cells.c1).toBe('hello')
    expect(t.rows[0]!.cells.c2).toBeUndefined()
  })
})

describe('extractPlainText', () => {
  it('列名と文字列・数値セルを連結する', () => {
    let t = createEmptyTable()
    t = renameColumn(t, t.columns[0]!.id, 'タイトル')
    t = addColumn(t, 'number', '数量')
    t = setCell(t, t.rows[0]!.id, t.columns[0]!.id, 'りんご')
    t = setCell(t, t.rows[0]!.id, t.columns[1]!.id, 3)
    const text = extractPlainText(t)
    expect(text).toContain('タイトル')
    expect(text).toContain('数量')
    expect(text).toContain('りんご')
    expect(text).toContain('3')
  })

  it('checkbox/空セルは含めない', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'checkbox', '完了')
    const text = extractPlainText(t)
    expect(text).toContain('名前')
    expect(text).toContain('完了')
    expect(text).not.toContain('false')
  })
})
