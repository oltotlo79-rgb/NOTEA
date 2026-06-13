import { describe, expect, it } from 'vitest'
import {
  createPageSchema,
  movePageSchema,
  pageIdSchema,
  reorderPageSchema,
  updateContentSchema,
  updateMetaSchema,
} from '@/lib/validations/pages'

// 有効な v4 UUID（z.uuid() は RFC の version/variant ビットを検証する）
const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

describe('pageIdSchema', () => {
  it('UUID を受理し、非 UUID を拒否', () => {
    expect(pageIdSchema.safeParse({ id: UUID }).success).toBe(true)
    expect(pageIdSchema.safeParse({ id: 'nope' }).success).toBe(false)
  })
})

describe('createPageSchema', () => {
  it('空入力（ルート・無題）を許可', () => {
    expect(createPageSchema.safeParse({}).success).toBe(true)
  })
  it('parentId と title を許可', () => {
    expect(createPageSchema.safeParse({ parentId: UUID, title: 'メモ' }).success).toBe(true)
  })
  it('parentId は null も許可', () => {
    expect(createPageSchema.safeParse({ parentId: null }).success).toBe(true)
  })
  it('200 文字超のタイトルを拒否', () => {
    expect(createPageSchema.safeParse({ title: 'あ'.repeat(201) }).success).toBe(false)
  })
})

describe('updateMetaSchema', () => {
  it('タイトルのみ・アイコンのみを許可', () => {
    expect(updateMetaSchema.safeParse({ id: UUID, title: 'x' }).success).toBe(true)
    expect(updateMetaSchema.safeParse({ id: UUID, icon: '📝' }).success).toBe(true)
    expect(updateMetaSchema.safeParse({ id: UUID, icon: null }).success).toBe(true)
  })
  it('id のみ（更新項目なし）は拒否', () => {
    expect(updateMetaSchema.safeParse({ id: UUID }).success).toBe(false)
  })
})

describe('updateContentSchema', () => {
  it('content 配列と contentText を受理', () => {
    expect(
      updateContentSchema.safeParse({ id: UUID, content: [{ type: 'paragraph' }], contentText: 'x' })
        .success
    ).toBe(true)
  })
  it('content が配列でなければ拒否', () => {
    expect(
      updateContentSchema.safeParse({ id: UUID, content: 'x', contentText: 'x' }).success
    ).toBe(false)
  })
})

describe('movePageSchema', () => {
  it('newParentId は UUID または null', () => {
    expect(movePageSchema.safeParse({ id: UUID, newParentId: UUID }).success).toBe(true)
    expect(movePageSchema.safeParse({ id: UUID, newParentId: null }).success).toBe(true)
  })
  it('newParentId 省略は拒否', () => {
    expect(movePageSchema.safeParse({ id: UUID }).success).toBe(false)
  })
})

describe('reorderPageSchema', () => {
  it('sortOrder は数値', () => {
    expect(reorderPageSchema.safeParse({ id: UUID, sortOrder: 1.5 }).success).toBe(true)
    expect(reorderPageSchema.safeParse({ id: UUID, sortOrder: 'x' }).success).toBe(false)
  })
})
