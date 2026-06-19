import { describe, expect, it } from 'vitest'
import {
  createEmptyTable,
  addColumn,
  removeColumn,
  renameColumn,
  changeColumnType,
  setColumnOptions,
  addRow,
  addRowWith,
  removeRow,
  setCell,
  coerceValue,
  defaultCellValue,
  parseTable,
  serializeTable,
  extractPlainText,
  setView,
  setBoardColumn,
  setDateColumn,
  groupRowsByColumn,
  groupRowsByDate,
  titleColumnId,
  BOARD_UNSET_KEY,
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

describe('ビュー設定', () => {
  it('setView / setBoardColumn / setDateColumn', () => {
    let t = createEmptyTable()
    t = setView(t, 'board')
    expect(t.view).toBe('board')
    t = setBoardColumn(t, 'col-x')
    expect(t.boardColumnId).toBe('col-x')
    t = setDateColumn(t, 'col-y')
    expect(t.dateColumnId).toBe('col-y')
  })

  it('parse/serialize でビュー設定が保持される', () => {
    let t = createEmptyTable()
    t = setView(t, 'calendar')
    t = setDateColumn(t, 'd1')
    const restored = parseTable(serializeTable(t))
    expect(restored.view).toBe('calendar')
    expect(restored.dateColumnId).toBe('d1')
  })

  it('不正な view 値は無視される', () => {
    const json = JSON.stringify({
      columns: [{ id: 'c1', name: 'A', type: 'text' }],
      rows: [],
      view: 'bogus',
    })
    expect(parseTable(json).view).toBeUndefined()
  })
})

describe('groupRowsByColumn（ボード）', () => {
  it('select 列の options 順にレーン分けし、末尾に未設定レーン', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'select', '状態')
    const colId = t.columns[1]!.id
    t = setColumnOptions(t, colId, ['未', '済'])
    // 1行目は未設定のまま、2行目=未、3行目=済
    t = setCell(t, t.rows[0]!.id, colId, '')
    t = addRowWith(t, { [colId]: '未' })
    t = addRowWith(t, { [colId]: '済' })

    const lanes = groupRowsByColumn(t, colId)
    expect(lanes.map((l) => l.key)).toEqual(['未', '済', BOARD_UNSET_KEY])
    expect(lanes[0]!.rows).toHaveLength(1)
    expect(lanes[1]!.rows).toHaveLength(1)
    expect(lanes[2]!.label).toBe('未設定')
    expect(lanes[2]!.rows).toHaveLength(1)
  })

  it('select でない列を指定すると未設定レーンのみ', () => {
    const t = createEmptyTable()
    const lanes = groupRowsByColumn(t, t.columns[0]!.id)
    expect(lanes).toHaveLength(1)
    expect(lanes[0]!.key).toBe(BOARD_UNSET_KEY)
  })
})

describe('groupRowsByDate（カレンダー）', () => {
  it('日付ごとに行をまとめ、空・不正日付は除外', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'date', '期限')
    const colId = t.columns[1]!.id
    t = setCell(t, t.rows[0]!.id, colId, '2026-06-19')
    t = addRowWith(t, { [colId]: '2026-06-19' })
    t = addRowWith(t, { [colId]: '2026-06-20' })
    t = addRowWith(t, {}) // 日付なし

    const map = groupRowsByDate(t, colId)
    expect(map.get('2026-06-19')).toHaveLength(2)
    expect(map.get('2026-06-20')).toHaveLength(1)
    expect(map.has('')).toBe(false)
  })
})

describe('titleColumnId', () => {
  it('最初の text 列を返す', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'number', '数量')
    expect(titleColumnId(t)).toBe(t.columns[0]!.id)
  })
  it('text 列が無ければ最初の列', () => {
    let t = createEmptyTable()
    t = changeColumnType(t, t.columns[0]!.id, 'number')
    expect(titleColumnId(t)).toBe(t.columns[0]!.id)
  })
})

describe('addRowWith', () => {
  it('プリセット値を型変換して行を追加', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'number', '数量')
    const numId = t.columns[1]!.id
    t = addRowWith(t, { [numId]: '5' })
    expect(t.rows[1]!.cells[numId]).toBe(5)
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
