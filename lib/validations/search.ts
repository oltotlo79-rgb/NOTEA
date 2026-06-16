import { z } from 'zod'
import { MAX_SEARCH_QUERY_LENGTH } from '@/lib/constants/limits'

export const searchQuerySchema = z.object({
  query: z
    .string()
    .min(1)
    .max(MAX_SEARCH_QUERY_LENGTH)
    .transform((s) => s.trim()),
  cursor: z.string().optional(),
})
