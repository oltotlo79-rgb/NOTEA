import { z } from 'zod'
import { MAX_PAGE_TITLE_LENGTH } from '@/lib/constants/limits'

const uuid = z.uuid()

export const pageIdSchema = z.object({ id: uuid })

export const createPageSchema = z.object({
  parentId: uuid.nullish(),
  title: z.string().max(MAX_PAGE_TITLE_LENGTH).optional(),
})

export const updateMetaSchema = z
  .object({
    id: uuid,
    title: z.string().max(MAX_PAGE_TITLE_LENGTH).optional(),
    icon: z.string().max(8).nullable().optional(),
  })
  .refine((d) => d.title !== undefined || d.icon !== undefined, {
    error: '更新する項目がありません',
  })

export const updateContentSchema = z.object({
  id: uuid,
  content: z.array(z.unknown()),
  contentText: z.string(),
})

export const movePageSchema = z.object({ id: uuid, newParentId: uuid.nullable() })

export const reorderPageSchema = z.object({ id: uuid, sortOrder: z.number() })

export const listCursorSchema = z.object({ cursor: z.string().optional() })
