import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataTableBlock } from '@/components/editor/blocks/DataTableBlock'
import {
  createEmptyTable,
  serializeTable,
  parseTable,
  addColumn,
  addRowWith,
  setColumnOptions,
  setView,
  setBoardColumn,
  setDateColumn,
  type DataTable,
} from '@/lib/editor/data-table'

function jsonOf(t: DataTable): string {
  return serializeTable(t)
}

let onChange: ReturnType<typeof vi.fn<(data: string) => void>>

beforeEach(() => {
  onChange = vi.fn<(data: string) => void>()
})

describe('DataTableBlock（編集可）', () => {
  it('列ヘッダと行を描画する', () => {
    const t = createEmptyTable()
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)
    expect(screen.getByTestId('data-table-block')).toBeInTheDocument()
    expect(screen.getByDisplayValue('名前')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '行を追加' })).toBeInTheDocument()
  })

  it('「行を追加」で onChange に行が増えた JSON を渡す', async () => {
    const t = createEmptyTable()
    const user = userEvent.setup()
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '行を追加' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = parseTable(onChange.mock.calls[0]![0] as string)
    expect(next.rows).toHaveLength(2)
  })

  it('「列を追加」で列が増える', async () => {
    const t = createEmptyTable()
    const user = userEvent.setup()
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '列を追加' }))

    const next = parseTable(onChange.mock.calls[0]![0] as string)
    expect(next.columns).toHaveLength(2)
  })

  it('テキストセルを入力して blur で onChange が呼ばれる', async () => {
    const t = createEmptyTable()
    const user = userEvent.setup()
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)

    const cell = screen.getByLabelText('名前 の入力')
    await user.type(cell, 'りんご')
    await user.tab()

    expect(onChange).toHaveBeenCalled()
    const next = parseTable(onChange.mock.calls.at(-1)![0] as string)
    expect(next.rows[0]!.cells[next.columns[0]!.id]).toBe('りんご')
  })

  it('列の型を数値に変えると select 反映され onChange する', async () => {
    const t = createEmptyTable()
    const user = userEvent.setup()
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)

    const typeSelect = screen.getByLabelText('列「名前」の型')
    await user.selectOptions(typeSelect, 'number')

    const next = parseTable(onChange.mock.calls.at(-1)![0] as string)
    expect(next.columns[0]!.type).toBe('number')
  })

  it('チェックボックス列のセルは即時 onChange する', async () => {
    let t = createEmptyTable()
    t = addColumn(t, 'checkbox', '完了')
    const user = userEvent.setup()
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)

    await user.click(screen.getByLabelText('完了 のチェック'))

    const next = parseTable(onChange.mock.calls.at(-1)![0] as string)
    expect(next.rows[0]!.cells[next.columns[1]!.id]).toBe(true)
  })

  it('列削除ボタンで列が消える', async () => {
    let t = createEmptyTable()
    t = addColumn(t, 'text', '備考')
    const user = userEvent.setup()
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '列「備考」を削除' }))

    const next = parseTable(onChange.mock.calls.at(-1)![0] as string)
    expect(next.columns).toHaveLength(1)
  })
})

describe('DataTableBlock ビュー切替', () => {
  it('編集可のときビュー切替タブを表示する', () => {
    render(<DataTableBlock data={jsonOf(createEmptyTable())} editable onChange={onChange} />)
    expect(screen.getByRole('tab', { name: 'テーブル' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'ボード' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'カレンダー' })).toBeInTheDocument()
  })

  it('ボードタブで view=board に更新する', async () => {
    const user = userEvent.setup()
    render(<DataTableBlock data={jsonOf(createEmptyTable())} editable onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: 'ボード' }))
    const next = parseTable(onChange.mock.calls.at(-1)![0] as string)
    expect(next.view).toBe('board')
  })
})

describe('DataTableBlock ボード表示', () => {
  function boardTable(): DataTable {
    let t = createEmptyTable()
    t = addColumn(t, 'select', '状態')
    const colId = t.columns[1]!.id
    t = setColumnOptions(t, colId, ['未', '済'])
    t = addRowWith(t, { [colId]: '未' })
    t = setBoardColumn(t, colId)
    t = setView(t, 'board')
    return t
  }

  it('select 列が無いとヒントを出す', () => {
    const t = setView(createEmptyTable(), 'board')
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)
    expect(screen.getByText(/「選択肢」型の列が必要/)).toBeInTheDocument()
  })

  it('レーン（未/済/未設定）を描画する', () => {
    render(<DataTableBlock data={jsonOf(boardTable())} editable onChange={onChange} />)
    // レーン見出し + カード内 select のオプションに同名が出るため getAllByText で存在を確認
    expect(screen.getAllByText('未').length).toBeGreaterThan(0)
    expect(screen.getAllByText('済').length).toBeGreaterThan(0)
    expect(screen.getAllByText('未設定').length).toBeGreaterThan(0)
    // 3 レーン（未/済/未設定）それぞれに「カードを追加」が出る
    expect(screen.getAllByRole('button', { name: 'カードを追加' })).toHaveLength(3)
  })

  it('カード追加でそのレーンの値を持つ行が増える', async () => {
    const user = userEvent.setup()
    render(<DataTableBlock data={jsonOf(boardTable())} editable onChange={onChange} />)
    // 「未」レーンのカード追加（最初のレーン）
    await user.click(screen.getAllByRole('button', { name: 'カードを追加' })[0]!)
    const next = parseTable(onChange.mock.calls.at(-1)![0] as string)
    const selectCol = next.columns.find((c) => c.type === 'select')!
    expect(next.rows.some((r) => r.cells[selectCol.id] === '未')).toBe(true)
  })
})

describe('DataTableBlock カレンダー表示', () => {
  it('date 列が無いとヒントを出す', () => {
    const t = setView(createEmptyTable(), 'calendar')
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)
    expect(screen.getByText(/「日付」型の列が必要/)).toBeInTheDocument()
  })

  it('date 列があると月グリッドと曜日見出しを描画する', () => {
    let t = createEmptyTable()
    t = addColumn(t, 'date', '期限')
    t = setDateColumn(t, t.columns[1]!.id)
    t = setView(t, 'calendar')
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)
    expect(screen.getByTestId('calendar-title')).toBeInTheDocument()
    expect(screen.getByText('日')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '次の月' })).toBeInTheDocument()
  })

  it('次の月ボタンで表示月が変わる', async () => {
    let t = createEmptyTable()
    t = addColumn(t, 'date', '期限')
    t = setDateColumn(t, t.columns[1]!.id)
    t = setView(t, 'calendar')
    const user = userEvent.setup()
    render(<DataTableBlock data={jsonOf(t)} editable onChange={onChange} />)
    const before = screen.getByTestId('calendar-title').textContent
    await user.click(screen.getByRole('button', { name: '次の月' }))
    expect(screen.getByTestId('calendar-title').textContent).not.toBe(before)
  })
})

describe('DataTableBlock（読取専用）', () => {
  it('編集コントロールを出さず値だけ表示する', () => {
    const t = createEmptyTable()
    render(<DataTableBlock data={jsonOf(t)} editable={false} onChange={onChange} />)

    expect(screen.queryByRole('button', { name: '行を追加' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('名前 の入力')).not.toBeInTheDocument()
    // 列名はテキストとして表示
    const block = screen.getByTestId('data-table-block')
    expect(within(block).getByText('名前')).toBeInTheDocument()
  })
})
