import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockSupabaseClient, type MockSupabaseClient } from '../../../../utils/test-utils'

let mockAdmin: MockSupabaseClient

const mockConstructEvent = vi.fn()
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({ webhooks: { constructEvent: mockConstructEvent } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockAdmin }))

const { POST } = await import('@/app/api/webhooks/stripe/route')

function makeRequest(body: string, signature: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature !== null) headers['stripe-signature'] = signature
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers,
    body,
  })
}

function setInsertResult(result: { data: unknown; error: { message: string } | null }) {
  mockAdmin._defaultResult.current = result as { data: unknown; error: { message: string } | null }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAdmin = createMockSupabaseClient()
  setInsertResult({ data: null, error: null })
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Stripe webhook POST', () => {
  it('署名ヘッダが無ければ 400', async () => {
    const res = await POST(makeRequest('{}', null))
    expect(res.status).toBe(400)
    expect(mockConstructEvent).not.toHaveBeenCalled()
  })

  it('署名検証に失敗したら 400（ボディを処理しない）', async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('signature mismatch')
    })
    const res = await POST(makeRequest('{}', 'bad-sig'))
    expect(res.status).toBe(400)
    const updateFn = mockAdmin._builder.update as ReturnType<typeof vi.fn>
    expect(updateFn).not.toHaveBeenCalled()
  })

  it('重複イベントは二重処理せず 200 を返す', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_dup',
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_1' } },
    })
    // webhook_events への insert が一意制約違反（重複）
    setInsertResult({ data: null, error: { message: 'duplicate key' } })

    const res = await POST(makeRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.duplicate).toBe(true)
    // 重複時は plan 更新（update）を行わない
    const updateFn = mockAdmin._builder.update as ReturnType<typeof vi.fn>
    expect(updateFn).not.toHaveBeenCalled()
  })

  it('checkout.session.completed で plan=paid に更新する', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_42' } },
    })

    const res = await POST(makeRequest('{}', 'sig'))
    expect(res.status).toBe(200)

    const updateFn = mockAdmin._builder.update as ReturnType<typeof vi.fn>
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ plan: 'paid' }))
    const eqFn = mockAdmin._builder.eq as ReturnType<typeof vi.fn>
    const calls = eqFn.mock.calls as Array<[string, unknown]>
    expect(calls.some(([c, v]) => c === 'stripe_customer_id' && v === 'cus_42')).toBe(true)
  })

  it('customer.subscription.deleted で plan=free に戻す', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_2',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_9', status: 'canceled' } },
    })

    await POST(makeRequest('{}', 'sig'))
    const updateFn = mockAdmin._builder.update as ReturnType<typeof vi.fn>
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ plan: 'free' }))
  })

  it('customer.subscription.updated（active）で plan=paid・期間末を保存する', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_3',
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_a',
          status: 'active',
          items: { data: [{ current_period_end: 1893456000 }] },
        },
      },
    })

    await POST(makeRequest('{}', 'sig'))
    const updateFn = mockAdmin._builder.update as ReturnType<typeof vi.fn>
    const arg = updateFn.mock.calls[0]![0] as { plan: string; plan_current_period_end: string | null }
    expect(arg.plan).toBe('paid')
    expect(arg.plan_current_period_end).not.toBeNull()
  })

  it('subscription.updated（canceled）は plan=free', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_4',
      type: 'customer.subscription.updated',
      data: { object: { customer: 'cus_b', status: 'canceled', items: { data: [] } } },
    })

    await POST(makeRequest('{}', 'sig'))
    const updateFn = mockAdmin._builder.update as ReturnType<typeof vi.fn>
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ plan: 'free' }))
  })

  it('関心の無いイベントは 200 で無視する', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_5',
      type: 'invoice.paid',
      data: { object: {} },
    })
    const res = await POST(makeRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    const updateFn = mockAdmin._builder.update as ReturnType<typeof vi.fn>
    expect(updateFn).not.toHaveBeenCalled()
  })
})
