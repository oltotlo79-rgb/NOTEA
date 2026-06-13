import { describe, expect, it } from 'vitest'
import {
  buildPageTree,
  getDepth,
  getDescendantIds,
  getSubtreeHeight,
  getSubtreeIds,
  type PageListItem,
} from '@/lib/services/page-tree'

function page(id: string, parent_id: string | null, sort_order = 0, title = id): PageListItem {
  return { id, parent_id, title, icon: null, sort_order }
}

// a(root) ├ b ├ d
//         │   └ e
//         └ c
// f(root)
const flat: PageListItem[] = [
  page('a', null, 1),
  page('b', 'a', 1),
  page('c', 'a', 2),
  page('d', 'b', 1),
  page('e', 'b', 2),
  page('f', null, 2),
]

describe('buildPageTree', () => {
  it('平坦なリストを親子ツリーに組み立てる', () => {
    const tree = buildPageTree(flat)
    expect(tree.map((n) => n.id)).toEqual(['a', 'f'])
    const a = tree[0]!
    expect(a.children.map((n) => n.id)).toEqual(['b', 'c'])
    expect(a.children[0]!.children.map((n) => n.id)).toEqual(['d', 'e'])
  })

  it('sort_order 昇順、同値はタイトルで安定ソートする', () => {
    const tree = buildPageTree([
      page('y', null, 5, 'やゆよ'),
      page('x', null, 5, 'あいう'),
      page('z', null, 1, 'ん'),
    ])
    expect(tree.map((n) => n.id)).toEqual(['z', 'x', 'y'])
  })

  it('親が存在しないノードはルートとして扱う（孤児救済）', () => {
    const tree = buildPageTree([page('orphan', 'missing', 1)])
    expect(tree.map((n) => n.id)).toEqual(['orphan'])
  })

  it('空配列は空ツリー', () => {
    expect(buildPageTree([])).toEqual([])
  })
})

describe('getDescendantIds', () => {
  it('root を除く全子孫を返す', () => {
    expect(getDescendantIds(flat, 'a').sort()).toEqual(['b', 'c', 'd', 'e'])
  })
  it('葉ノードは空', () => {
    expect(getDescendantIds(flat, 'd')).toEqual([])
  })
})

describe('getSubtreeIds', () => {
  it('root を含むサブツリー全 id を返す', () => {
    expect(getSubtreeIds(flat, 'b').sort()).toEqual(['b', 'd', 'e'])
  })
})

describe('getDepth', () => {
  it('ルートは 1', () => {
    expect(getDepth(flat, 'a')).toBe(1)
  })
  it('孫は 3', () => {
    expect(getDepth(flat, 'd')).toBe(3)
  })
  it('循環参照があっても無限ループしない', () => {
    const cyclic = [page('p', 'q'), page('q', 'p')]
    expect(getDepth(cyclic, 'p')).toBeGreaterThan(0)
  })
})

describe('getSubtreeHeight', () => {
  it('葉は 1', () => {
    expect(getSubtreeHeight(flat, 'd')).toBe(1)
  })
  it('a の高さは 3（a→b→d/e）', () => {
    expect(getSubtreeHeight(flat, 'a')).toBe(3)
  })
})
