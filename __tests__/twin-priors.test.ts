import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// twin-priors — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    userTwinPrior: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { getEffectPriors, updateEffectPrior } from '@/lib/agents/twin-priors'

describe('getEffectPriors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns population defaults when userId is undefined', async () => {
    const priors = await getEffectPriors(undefined, 'metformin')
    expect(priors).toHaveProperty('hba1c')
    expect(priors.hba1c.targetDeltaPct).toBe(-0.1)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('returns population defaults when no UserTwinPrior rows exist', async () => {
    mocks.findMany.mockResolvedValue([])
    const priors = await getEffectPriors('user-1', 'rapamycin')
    expect(priors.hs_crp.targetDeltaPct).toBe(-0.25)
  })

  it('overrides with user-specific prior when a row exists', async () => {
    mocks.findMany.mockResolvedValue([
      { outcomeKey: 'hs_crp', prior: -0.40 },
    ])
    const priors = await getEffectPriors('user-1', 'rapamycin')
    expect(priors.hs_crp.targetDeltaPct).toBe(-0.40)
    // halfLifeWeeks should be preserved from population default
    expect(priors.hs_crp.halfLifeWeeks).toBe(8)
  })

  it('falls back to population defaults on DB error', async () => {
    mocks.findMany.mockRejectedValue(new Error('DB down'))
    const priors = await getEffectPriors('user-1', 'statin')
    expect(priors.ldl.targetDeltaPct).toBe(-0.4)
  })

  it('returns empty object for unknown compound', async () => {
    mocks.findMany.mockResolvedValue([])
    const priors = await getEffectPriors('user-1', 'unknown_compound_xyz')
    expect(Object.keys(priors)).toHaveLength(0)
  })
})

describe('updateEffectPrior', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new prior when none exists — Bayesian update with n=0', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.upsert.mockResolvedValue({ id: 'prior-1' })

    await updateEffectPrior('user-1', {
      compoundId: 'metformin',
      outcomeKey: 'hba1c',
      observedDeltaPct: -0.15,
      recommendedPriorAdjustment: -0.15,
    })

    const upsertCall = mocks.upsert.mock.calls[0][0]
    // (0 × -0.10 + -0.15) / (0 + 1) = -0.15
    expect(upsertCall.update.prior).toBeCloseTo(-0.15, 5)
    expect(upsertCall.update.n).toBe(1)
  })

  it('Bayesian-updates an existing prior', async () => {
    mocks.findUnique.mockResolvedValue({ prior: -0.10, n: 4 })
    mocks.upsert.mockResolvedValue({ id: 'prior-1' })

    await updateEffectPrior('user-1', {
      compoundId: 'metformin',
      outcomeKey: 'hba1c',
      observedDeltaPct: -0.20,
      recommendedPriorAdjustment: -0.20,
    })

    const upsertCall = mocks.upsert.mock.calls[0][0]
    // (4 × -0.10 + -0.20) / (4 + 1) = -0.6/5 = -0.12
    expect(upsertCall.update.prior).toBeCloseTo(-0.12, 5)
    expect(upsertCall.update.n).toBe(5)
  })

  it('bounds the prior to ±50% of the population default', async () => {
    // Population default for metformin/hba1c = -0.10
    // ±50% → allowed range: [-0.15, -0.05]
    // Observed = -0.40 (extreme outlier)
    mocks.findUnique.mockResolvedValue({ prior: -0.10, n: 1 })
    mocks.upsert.mockResolvedValue({ id: 'prior-1' })

    await updateEffectPrior('user-1', {
      compoundId: 'metformin',
      outcomeKey: 'hba1c',
      observedDeltaPct: -0.40,
      recommendedPriorAdjustment: -0.40,
    })

    const upsertCall = mocks.upsert.mock.calls[0][0]
    // Bayesian result = (1×-0.10 + -0.40)/2 = -0.25 — exceeds bound
    // Clamped to population_default - 50% = -0.10 - 0.05 = -0.15
    expect(upsertCall.update.prior).toBeGreaterThanOrEqual(-0.15 - 0.0001)
    expect(upsertCall.update.prior).toBeLessThanOrEqual(-0.05 + 0.0001)
  })

  it('swallows DB errors without throwing', async () => {
    mocks.findUnique.mockRejectedValue(new Error('connection refused'))
    await expect(
      updateEffectPrior('user-1', {
        compoundId: 'metformin',
        outcomeKey: 'hba1c',
        observedDeltaPct: -0.15,
        recommendedPriorAdjustment: -0.15,
      }),
    ).resolves.toBeUndefined()
  })
})
