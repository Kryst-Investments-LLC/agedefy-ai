import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// prediction-log-sweeper — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  simRunFindMany: vi.fn(),
  simRunUpdate: vi.fn(),
  biomarkerFindFirst: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    twinSimulationRun: {
      findMany: mocks.simRunFindMany,
      update: mocks.simRunUpdate,
    },
    biomarkerRecord: {
      findFirst: mocks.biomarkerFindFirst,
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: mocks.loggerError },
}))

import { sweepExpiredPredictions } from '@/lib/loop/prediction-log-sweeper'

const BASE_RUN = {
  id: 'run-1',
  userId: 'user-1',
  endpoint: 'CRP_AUC',
  predictedMean: -1.5,
}

describe('sweepExpiredPredictions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns scored=0, skipped=0, errors=0 when no expired runs', async () => {
    mocks.simRunFindMany.mockResolvedValue([])
    const result = await sweepExpiredPredictions()
    expect(result).toEqual({ scored: 0, skipped: 0, errors: 0 })
    expect(mocks.simRunUpdate).not.toHaveBeenCalled()
  })

  it('skips runs when no biomarker observation is found', async () => {
    mocks.simRunFindMany.mockResolvedValue([BASE_RUN])
    mocks.biomarkerFindFirst.mockResolvedValue(null)
    const result = await sweepExpiredPredictions()
    expect(result.skipped).toBe(1)
    expect(result.scored).toBe(0)
    expect(mocks.simRunUpdate).not.toHaveBeenCalled()
  })

  it('scores and updates run when biomarker observation found', async () => {
    mocks.simRunFindMany.mockResolvedValue([BASE_RUN])
    mocks.biomarkerFindFirst.mockResolvedValue({ numericValue: -1.4 }) // close to -1.5
    mocks.simRunUpdate.mockResolvedValue({})
    const result = await sweepExpiredPredictions()
    expect(result.scored).toBe(1)
    expect(result.errors).toBe(0)
    expect(mocks.simRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ twinAccuracyScore: expect.any(Number) }),
      }),
    )
  })

  it('assigns high accuracy score when observed is within 10% of predicted', async () => {
    mocks.simRunFindMany.mockResolvedValue([{ ...BASE_RUN, predictedMean: -1.0 }])
    mocks.biomarkerFindFirst.mockResolvedValue({ numericValue: -1.0 }) // exact match
    mocks.simRunUpdate.mockResolvedValue({})
    await sweepExpiredPredictions()
    const scoreArg = mocks.simRunUpdate.mock.calls[0][0].data.twinAccuracyScore
    expect(scoreArg).toBeGreaterThanOrEqual(0.8)
  })

  it('assigns low accuracy score when observed direction reversed', async () => {
    mocks.simRunFindMany.mockResolvedValue([{ ...BASE_RUN, predictedMean: -1.0 }])
    mocks.biomarkerFindFirst.mockResolvedValue({ numericValue: 0.5 }) // wrong direction
    mocks.simRunUpdate.mockResolvedValue({})
    await sweepExpiredPredictions()
    const scoreArg = mocks.simRunUpdate.mock.calls[0][0].data.twinAccuracyScore
    expect(scoreArg).toBe(0)
  })

  it('counts errors when simRunUpdate throws', async () => {
    mocks.simRunFindMany.mockResolvedValue([BASE_RUN])
    mocks.biomarkerFindFirst.mockResolvedValue({ numericValue: -1.4 })
    mocks.simRunUpdate.mockRejectedValue(new Error('db error'))
    const result = await sweepExpiredPredictions()
    expect(result.errors).toBe(1)
    expect(result.scored).toBe(0)
  })

  it('handles multiple runs correctly', async () => {
    mocks.simRunFindMany.mockResolvedValue([
      { ...BASE_RUN, id: 'run-1', predictedMean: -1.0 },
      { ...BASE_RUN, id: 'run-2', predictedMean: 2.0 },
    ])
    // run-1: biomarker found, run-2: not found
    mocks.biomarkerFindFirst
      .mockResolvedValueOnce({ numericValue: -1.0 })
      .mockResolvedValueOnce(null)
    mocks.simRunUpdate.mockResolvedValue({})
    const result = await sweepExpiredPredictions()
    expect(result.scored).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toBe(0)
  })
})
