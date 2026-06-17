import 'server-only'
import Stripe from 'stripe'
import { requireEnv } from '@/lib/utils/env'

/**
 * @module lib/stripe/server
 * Stripe サーバークライアント。秘密鍵を使うためサーバー専用（server-only）。
 * クライアントバンドルに混入させない。
 */
export function getStripe(): Stripe {
  return new Stripe(requireEnv(process.env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY'))
}
