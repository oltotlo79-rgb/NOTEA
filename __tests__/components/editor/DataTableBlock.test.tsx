import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataTableBlock } from '@/components/editor/blocks/DataTableBlock'
import {
  createEmptyTable,
  serializeTable,
  parseTable,
  addColumn,
  type DataTable,
} from '@/lib/editor/data-table'

function jsonOf(t: DataTable): string {
  return serializeTable(t)
}

let onChange: ReturnType<typeof vi.fn>

beforeEach(() => {
  onChange = vi.fn()
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
