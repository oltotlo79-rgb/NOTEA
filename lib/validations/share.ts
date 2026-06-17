import { z } from 'zod'
import { SHARE_PERMISSIONS } from '@/lib/constants/limits'

const uuid = z.uuid()
const permission = z.enum(SHARE_PERMISSIONS)

// base64url トークン。長さは固定生成だが、最低限の形式チェックで不正値を弾く
const token = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/)

export const createShareSchema = z.object({ pageId: uuid, permission })
export const revokeShareSchema = z.object({ pageId: uuid, permission })
export const listSharesSchema = z.object({ pageId: uuid })

export const sharedPageTokenSchema = z.object({ token })

export const updateSharedContentSchema = z.object({
  token,
  content: z.array(z.unknown()),
  contentText: z.string(),
})

export const sharedImageSchema = z.object({
  token,
  path: z.string().min(1).max(1024),
})
