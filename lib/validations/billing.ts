import { z } from 'zod'
import { BILLING_PLANS } from '@/lib/constants/billing'

export const checkoutSchema = z.object({ plan: z.enum(BILLING_PLANS) })
