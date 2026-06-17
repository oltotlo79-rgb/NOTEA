import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../utils/test-utils'

let mockClient: MockSupabaseClient
let mockAdmin: MockSupabaseClient

const mockStripe = {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => mockClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockAdmin }))
vi.mock('@/lib/stripe/server', () => ({ getStripe: () => mockStripe }))

const { createCheckoutSession, createPortalSession } = await import('@/lib/actions/billing')

beforeEach(() => {
  vi.clearAllMocks()
  mockClient = createMockSupabaseClient()
  mockAdmin = createMockSupabaseClient()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com')
  vi.stubEnv('STRIPE_PRICE_MONTHLY', 'price_monthly_123')
  vi.stubEnv('STRIPE_PRICE_YEARLY', 'price_yearly_123')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('createCheckoutSession', () => {
  it('未認証はエラー', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await createCheckoutSession({ plan: 'monthly' })
    expect(result).toMatchObject({ success: false })
  })

  it('不正な plan は Zod で拒否', async () => {
    // @ts-expect-error 不正入力
    const result = await createCheckoutSession({ plan: 'lifetime' })
    expect(result).toMatchObject({ success: false })
  })

  it('価格 ID の env が無ければエラー', async () => {
    vi.stubEnv('STRIPE_PRICE_MONTHLY', '')
    const result = await createCheckoutSession({ plan: 'monthly' })
    expect(result).toMatchObject({ success: false })
  })

  it('既存 customer がある場合は customers.create を呼ばず Checkout URL を返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { stripe_customer_id: 'cus_existing' }, error: null })
    mockStripe.checkout.sessions.create.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/s/1' })

    const result = await createCheckoutSession({ plan: 'monthly' })
    expect(mockStripe.customers.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: true, data: { url: 'https://checkout.stripe.com/s/1' } })
    // 正しい価格・サブスクモード
    const arg = mockStripe.checkout.sessions.create.mock.calls[0]![0]
    expect(arg.mode).toBe('subscription')
    expect(arg.line_items[0].price).toBe('price_monthly_123')
  })

  it('customer が無ければ作成し、stripe_customer_id を admin で保存する', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { stripe_customer_id: null }, error: null })
    mockStripe.customers.create.mockResolvedValueOnce({ id: 'cus_new' })
    mockStripe.checkout.sessions.create.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/s/2' })

    const result = await createCheckoutSession({ plan: 'yearly' })
    expect(mockStripe.customers.create).toHaveBeenCalled()
    // admin で profiles を更新（plan 列権限の都合）
    const adminUpdate = mockAdmin._builder.update as ReturnType<typeof vi.fn>
    expect(adminUpdate).toHaveBeenCalledWith(expect.objectContaining({ stripe_customer_id: 'cus_new' }))
    expect(result).toMatchObject({ success: true })
  })

  it('Stripe 呼び出しが throw したらエラーを返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { stripe_customer_id: 'cus_x' }, error: null })
    mockStripe.checkout.sessions.create.mockRejectedValueOnce(new Error('stripe down'))
    const result = await createCheckoutSession({ plan: 'monthly' })
    expect(result).toMatchObject({ success: false })
  })

  it('引数に apiKey 等の鍵フィールドを含めない（BYOK 不変・課金は無関係だが念のため）', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { stripe_customer_id: 'cus_x' }, error: null })
    mockStripe.checkout.sessions.create.mockResolvedValueOnce({ url: 'https://x' })
    await createCheckoutSession({ plan: 'monthly' })
    const arg = mockStripe.checkout.sessions.create.mock.calls[0]![0]
    expect(JSON.stringify(arg)).not.toContain('apiKey')
  })
})

describe('createPortalSession', () => {
  it('未認証はエラー', async () => {
    mockClient = createMockSupabaseClient({ user: null })
    const result = await createPortalSession()
    expect(result).toMatchObject({ success: false })
  })

  it('customer が無ければサブスクなしエラー', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { stripe_customer_id: null }, error: null })
    const result = await createPortalSession()
    expect(result).toMatchObject({ success: false })
    expect(mockStripe.billingPortal.sessions.create).not.toHaveBeenCalled()
  })

  it('customer があればポータル URL を返す', async () => {
    mockClient._maybeSingle.mockResolvedValueOnce({ data: { stripe_customer_id: 'cus_p' }, error: null })
    mockStripe.billingPortal.sessions.create.mockResolvedValueOnce({ url: 'https://billing.stripe.com/p/1' })
    const result = await createPortalSession()
    expect(result).toMatchObject({ success: true, data: { url: 'https://billing.stripe.com/p/1' } })
  })
})
