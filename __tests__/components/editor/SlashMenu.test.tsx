/**
 * @module __tests__/components/editor/SlashMenu.test.tsx
 * SlashMenu コンポーネントのユニットテスト。
 * @blocknote/react の型のみ使用し、実コンポーネントの描画をテストする。
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SlashMenu } from '@/components/editor/SlashMenu'
import type { DefaultReactSuggestionItem } from '@blocknote/react'

function makeItem(title: string, group?: string, subtext?: string): DefaultReactSuggestionItem {
  return {
    title,
    onItemClick: vi.fn(),
    group: group ?? '基本ブロック',
    subtext,
    icon: <span>{title[0]}</span>,
    aliases: [],
  }
}

describe('SlashMenu', () => {
  // =====================
  // loading-initial 状態
  // =====================
  describe('loadingState=loading-initial', () => {
    it('loading-initial のときは何も描画しない', () => {
      const { container } = render(
        <SlashMenu
          items={[]}
          loadingState="loading-initial"
          selectedIndex={0}
          onItemClick={vi.fn()}
        />
      )
      expect(container.firstChild).toBeNull()
    })
  })

  // =====================
  // 空アイテム
  // =====================
  describe('アイテムが 0 件', () => {
    it('data-testid="slash-command-menu" が存在する', () => {
      render(
        <SlashMenu
          items={[]}
          loadingState="loaded"
          selectedIndex={-1}
          onItemClick={vi.fn()}
        />
      )
      expect(screen.getByTestId('slash-command-menu')).toBeInTheDocument()
    })

    it('「一致するコマンドはありません」を表示する', () => {
      render(
        <SlashMenu
          items={[]}
          loadingState="loaded"
          selectedIndex={-1}
          onItemClick={vi.fn()}
        />
      )
      expect(screen.getByText('一致するコマンドはありません')).toBeInTheDocument()
    })
  })

  // =====================
  // 通常のアイテムリスト
  // =====================
  describe('アイテムがある場合', () => {
    const items = [
      makeItem('段落', '基本ブロック', '通常テキストを入力'),
      makeItem('見出し 1', '基本ブロック', '大きな見出し'),
      makeItem('箇条書き', 'リスト', '箇条書きリスト'),
    ]

    it('data-testid="slash-command-menu" が存在する', () => {
      render(
        <SlashMenu
          items={items}
          loadingState="loaded"
          selectedIndex={-1}
          onItemClick={vi.fn()}
        />
      )
      expect(screen.getByTestId('slash-command-menu')).toBeInTheDocument()
    })

    it('role="listbox" が付与される', () => {
      render(
        <SlashMenu
          items={items}
          loadingState="loaded"
          selectedIndex={-1}
          onItemClick={vi.fn()}
        />
      )
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('aria-label="コマンドを選択" が付与される', () => {
      render(
        <SlashMenu
          items={items}
          loadingState="loaded"
          selectedIndex={-1}
          onItemClick={vi.fn()}
        />
      )
      expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'コマンドを選択')
    })

    it('全アイテムのタイトルが表示される', () => {
      render(
        <SlashMenu
          items={items}
          loadingState="loaded"
          selectedIndex={-1}
          onItemClick={vi.fn()}
        />
      )
      expect(screen.getByText('段落')).toBeInTheDocument()
      expect(screen.getByText('見出し 1')).toBeInTheDocument()
      expect(screen.getByText('箇条書き')).toBeInTheDocument()
    })

    it('サブテキストが表示される', () => {
      render(
        <SlashMenu
          items={items}
          loadingState="loaded"
          selectedIndex={-1}
          onItemClick={vi.fn()}
        />
      )
      expect(screen.getByText('通常テキストを入力')).toBeInTheDocument()
      expect(screen.getByText('大きな見出し')).toBeInTheDocument()
    })

    it('グループラベルが表示される', () => {
      render(
        <SlashMenu
          items={items}
          loadingState="loaded"
          selectedIndex={-1}
          onItemClick={vi.fn()}
        />
      )
      expect(screen.getByText('基本ブロック')).toBeInTheDocument()
      expect(screen.getByText('リスト')).toBeInTheDocument()
    })
  })

  // =====================
  // 選択状態
  // =====================
  describe('選択状態（selectedIndex）', () => {
    const items = [
      makeItem('段落', '基本ブロック'),
      makeItem('見出し 1', '基本ブロック'),
    ]

    it('selectedIndex=0 のとき最初のアイテムが aria-selected=true', () => {
      render(
        <SlashMenu
          items={items}
          loadingState="loaded"
          selectedIndex={0}
          onItemClick={vi.fn()}
        />
      )
      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
      expect(options[1]).toHaveAttribute('aria-selected', 'false')
    })

    it('selectedIndex=1 のとき 2 番目のアイテムが aria-selected=true', () => {
      render(
        <SlashMenu
          items={items}
          loadingState="loaded"
          selectedIndex={1}
          onItemClick={vi.fn()}
        />
      )
      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'false')
      expect(options[1]).toHaveAttribute('aria-selected', 'true')
    })

    it('selectedIndex=-1 のとき全アイテムが aria-selected=false', () => {
      render(
        <SlashMenu
          items={items}
          loadingState="loaded"
          selectedIndex={-1}
          onItemClick={vi.fn()}
        />
      )
      const options = screen.getAllByRole('option')
      options.forEach((opt) => {
        expect(opt).toHaveAttribute('aria-selected', 'false')
      })
    })
  })

  // =====================
  // onItemClick
  // =====================
  describe('onItemClick', () => {
    it('アイテムをクリックすると onItemClick が対象アイテムで呼ばれる', async () => {
      const user = userEvent.setup()
      const onItemClick = vi.fn()
      const items = [makeItem('段落', '基本ブロック')]
      render(
        <SlashMenu
          items={items}
          loadingState="loaded"
          selectedIndex={-1}
          onItemClick={onItemClick}
        />
      )
      await user.click(screen.getByText('段落'))
      expect(onItemClick).toHaveBeenCalledWith(items[0])
    })
  })
})
