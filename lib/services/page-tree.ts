/**
 * @module lib/services/page-tree
 * ページ階層の純粋なツリー操作。DB・認証に依存せず、Action 層が取得した
 * 平坦なページ配列を受け取って木の組み立て・サブツリー抽出・深さ計算を行う。
 */

export type PageListItem = {
  id: string
  parent_id: string | null
  title: string
  icon: string | null
  sort_order: number
}

export type PageTreeNode = PageListItem & { children: PageTreeNode[] }

type NodeRef = { id: string; parent_id: string | null }

export function buildPageTree(pages: PageListItem[]): PageTreeNode[] {
  const nodes = new Map<string, PageTreeNode>()
  for (const page of pages) {
    nodes.set(page.id, { ...page, children: [] })
  }

  const roots: PageTreeNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined
    // parent_id が指す親が存在しない（孤児）場合はルートに昇格させて取りこぼさない
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (list: PageTreeNode[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
    for (const node of list) sortNodes(node.children)
  }
  sortNodes(roots)

  return roots
}

function buildChildrenIndex(pages: NodeRef[]): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const page of pages) {
    if (page.parent_id === null) continue
    const siblings = index.get(page.parent_id) ?? []
    siblings.push(page.id)
    index.set(page.parent_id, siblings)
  }
  return index
}

export function getDescendantIds(pages: NodeRef[], rootId: string): string[] {
  const childrenOf = buildChildrenIndex(pages)
  const result: string[] = []
  const stack = [...(childrenOf.get(rootId) ?? [])]
  const visited = new Set<string>()
  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined || visited.has(id)) continue
    visited.add(id)
    result.push(id)
    stack.push(...(childrenOf.get(id) ?? []))
  }
  return result
}

export function getSubtreeIds(pages: NodeRef[], rootId: string): string[] {
  return [rootId, ...getDescendantIds(pages, rootId)]
}

export function getDepth(pages: NodeRef[], pageId: string): number {
  const parentOf = new Map<string, string | null>()
  for (const page of pages) parentOf.set(page.id, page.parent_id)

  let depth = 0
  let current: string | null | undefined = pageId
  const visited = new Set<string>()
  while (current && !visited.has(current)) {
    visited.add(current)
    depth += 1
    current = parentOf.get(current) ?? null
  }
  return depth
}

export function getSubtreeHeight(pages: NodeRef[], rootId: string): number {
  const childrenOf = buildChildrenIndex(pages)

  const heightFrom = (id: string, visited: Set<string>): number => {
    if (visited.has(id)) return 0
    visited.add(id)
    const children = childrenOf.get(id) ?? []
    let max = 0
    for (const child of children) {
      max = Math.max(max, heightFrom(child, visited))
    }
    return max + 1
  }

  return heightFrom(rootId, new Set())
}
