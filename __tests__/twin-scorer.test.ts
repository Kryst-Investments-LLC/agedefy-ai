import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// twin-scorer — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  simFind: vi.fn(),
  biomarkerFindMany: vi.fn(),
  biomarkerFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    twinSimulationRun: { findUnique: mocks.simFind },
    biomarker: { findMany: mocks.biomarkerFindMany, findFirst: mocks.biomarkerFindFirst },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { scoreTwinPrediction } from '@/lib/loop/twin-scorer'

const SIM_DATE = new Date('2026-05-01T00:00:00Z')
const BASE_SIM = {
  id: 'sim-1',
  userId: 'user-1',
  endpoint: 'hs_crp',
  predictedMean: 2.0,    // predicted final value (baseline was 4.0, so -2.0 delta)
  horizonDays: 90,
  createdAt: SIM_DATE,
}

describe('scoreTwinPrediction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns status=error when simulation is not found', async () => {
    mocks.simFind.mockResolvedValue(null)
    const result = await scoreTwinPrediction('missing-sim')
    expect(result.status).toBe('error')
  })

  it('returns not_enough_data when no observations exist in window', async () => {
    mocks.simFind.mockResolvedValue(BASE_SIM)
    mocks.biomarkerFindMany.mockResolvedValue([])

    const result = await scoreTwinPrediction('sim-1')
    expect(result.status).toBe('not_enough_data')
    expect(result.accuracyRatio).toBeNull()
  })

  it('scores perfect direction + magnitude within 20% as accuracyRatio=1.0', async () => {
    mocks.simFind.mockResolvedValue(BASE_SIM)
    // Observed ~2.1 (within 20% of predicted 2.0)
    mocks.biomarkerFindMany.mockResolvedValue([
      { value: 2.1, measuredAt: new Date('2026-06-01T00:00:00Z') },
    ])
    mocks.biomarkerFindFirst.mockResolvedValue({ value: 4.0 }) // baseline

    const result = await scoreTwinPrediction('sim-1')
    expect(result.status).toBe('scored')
    expect(result.directionCorrect).toBe(true)
    expect(result.magnitudeWithin20Pct).toBe(true)
    expect(result.accuracyRatio).toBe(1.0)
  })

  it('scores correct direction but wrong magnitude as accuracyRatio=0.5', async () => {
    mocks.simFind.mockResolvedValue(BASE_SIM)
    // Observed 3.0 (down from 4.0, direction correct, but predicted 2.0 — 50% off)
    mocks.biomarkerFindMany.mockResolvedValue([
      { value: 3.0, measuredAt: new Date('2026-06-01T00:00:00Z') },
    ])
    mocks.biomarkerFindFirst.mockResolvedValue({ value: 4.0 })

    const result = await scoreTwinPrediction('sim-1')
    expect(result.directionCorrect).toBe(true)
    expect(result.magnitudeWithin20Pct).toBe(false)
    expect(result.accuracyRatio).toBe(0.5)
  })

  it('scores wrong direction as accuracyRatio=0.0', async () => {
    mocks.simFind.mockResolvedValue(BASE_SIM)
    // Observed 5.0 (went UP, but we predicted DOWN to 2.0)
    mocks.biomarkerFindMany.mockResolvedValue([
      { value: 5.0, measuredAt: new Date('2026-06-01T00:00:00Z') },
    ])
    mocks.biomarkerFindFirst.mockResolvedValue({ value: 4.0 })

    const result = await scoreTwinPrediction('sim-1')
    expect(result.directionCorrect).toBe(false)
    expect(result.accuracyRatio).toBe(0.0)
  })

  it('returns status=error (does not throw) on DB failure', async () => {
    mocks.simFind.mockRejectedValue(new Error('connection refused'))
    const result = await scoreTwinPrediction('sim-1')
    expect(result.status).toBe('error')
  })
})
