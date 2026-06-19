import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// graph-usage-billing — unit tests
// ---------------------------------------------------------------------------
// Mutable mock state is established via vi.hoisted so that vi.mock factories
// can reference it, and individual tests can mutate state between calls.

const mocks = vi.hoisted(() => ({
  meterCreate: vi.fn(),
  findUnique: vi.fn(),
  // envState is a mutable object — billing module reads .STRIPE_GRAPH_PRICE_ID at call time
  envState: { STRIPE_GRAPH_PRICE_ID: 'price_test_123' as string | undefined },
  // stripeAvailable controls whether stripe export is null or the full mock
  stripeAvailable: { value: true },
}))

vi.mock('@/lib/stripe', () => ({
  get stripe() {
    if (!mocks.stripeAvailable.value) return null
    return { billing: { meterEvents: { create: mocks.meterCreate } } }
  },
}))

vi.mock('@/lib/env', () => ({
  // getter so reads always use the current envState value
  get env() { return mocks.envState },
}))

vi.mock('@/lib/db', () => ({
  db: { aPIKey: { findUnique: mocks.findUnique } },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { reportGraphQueryUsage } from '@/lib/billing/graph-usage-billing'

describe('reportGraphQueryUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.envState.STRIPE_GRAPH_PRICE_ID = 'price_test_123'
    mocks.stripeAvailable.value = true
  })

  it('returns not_configured when STRIPE_GRAPH_PRICE_ID is absent', async () => {
    mocks.envState.STRIPE_GRAPH_PRICE_ID = undefined
    const result = await reportGraphQueryUsage({ keyId: 'key-1' })
    expect(result).toEqual({ reported: false, reason: 'not_configured' })
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('returns not_configured when stripe singleton is null', async () => {
    mocks.stripeAvailable.value = false
    const result = await reportGraphQueryUsage({ keyId: 'key-1' })
    expect(result).toEqual({ reported: false, reason: 'not_configured' })
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('returns key_not_found when the API key row is missing from the DB', async () => {
    mocks.findUnique.mockResolvedValue(null)
    const result = await reportGraphQueryUsage({ keyId: 'missing-key' })
    expect(result).toEqual({ reported: false, reason: 'key_not_found' })
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: 'missing-key' },
      select: { user: { select: { stripeCustomerId: true } } },
    })
    expect(mocks.meterCreate).not.toHaveBeenCalled()
  })

  it('returns no_stripe_customer when user has no stripeCustomerId', async () => {
    mocks.findUnique.mockResolvedValue({ user: { stripeCustomerId: null } })
    const result = await reportGraphQueryUsage({ keyId: 'key-no-cust' })
    expect(result).toEqual({ reported: false, reason: 'no_stripe_customer' })
    expect(mocks.meterCreate).not.toHaveBeenCalled()
  })

  it('returns reported:true with correct eventId on successful Stripe call', async () => {
    const bucket = Math.floor(Date.now() / 60_000)
    const expectedIdentifier = `graph-key-1-${bucket}`
    mocks.findUnique.mockResolvedValue({ user: { stripeCustomerId: 'cus_abc' } })
    mocks.meterCreate.mockResolvedValue({ identifier: expectedIdentifier })

    const result = await reportGraphQueryUsage({ keyId: 'key-1', units: 3 })

    expect(result).toEqual({ reported: true, units: 3, eventId: expectedIdentifier })
    expect(mocks.meterCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: 'biozephyra_graph_query',
        payload: { value: '3', stripe_customer_id: 'cus_abc' },
        identifier: expectedIdentifier,
      }),
    )
  })

  it('defaults units to 1 when not provided', async () => {
    mocks.findUnique.mockResolvedValue({ user: { stripeCustomerId: 'cus_abc' } })
    mocks.meterCreate.mockResolvedValue({ identifier: 'evt-x' })

    const result = await reportGraphQueryUsage({ keyId: 'key-1' })

    expect(result).toMatchObject({ reported: true, units: 1 })
    expect(mocks.meterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ value: '1' }) }),
    )
  })

  it('returns error (does not throw) when Stripe API call fails', async () => {
    mocks.findUnique.mockResolvedValue({ user: { stripeCustomerId: 'cus_abc' } })
    mocks.meterCreate.mockRejectedValue(new Error('Stripe connection refused'))

    await expect(reportGraphQueryUsage({ keyId: 'key-1' })).resolves.toEqual({
      reported: false,
      reason: 'error',
    })
  })
})
