import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// pk-fitter — unit tests
// Tests the pure fitting logic + DB contract for UserPkProfile.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  outcomeFindMany: vi.fn(),
  pkProfileUpsert: vi.fn(),
  pkProfileFindUnique: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    protocolOutcome: { findMany: mocks.outcomeFindMany },
    userPkProfile: {
      upsert: mocks.pkProfileUpsert,
      findUnique: mocks.pkProfileFindUnique,
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: mocks.loggerError },
}))

import { fitPkProfile, getPkProfile, PK_POPULATION_DEFAULTS } from '@/lib/agents/pk-fitter'

const FITTED_PROFILE = {
  userId: 'user-1',
  compoundId: 'rapamycin',
  vd: 50,
  cl: 5,
  ka: 1.0,
  f: 0.7,
  n: 2,
  rmse: 0.05,
  fittedAt: new Date('2026-06-01'),
  fittedFromOutcomeIds: ['o1', 'o2'],
}

function makeOutcome(id: string, deltas: number[]) {
  return {
    id,
    observedBiomarkers: deltas.map((d) => ({ observedDelta: d })),
    cycleStartDate: new Date('2026-03-01'),
    cycleEndDate: new Date('2026-03-29'),
  }
}

describe('fitPkProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when fewer than 2 outcomes exist', async () => {
    mocks.outcomeFindMany.mockResolvedValue([makeOutcome('o1', [-1.2])])
    const result = await fitPkProfile('user-1', 'rapamycin')
    expect(result).toBeNull()
    expect(mocks.pkProfileUpsert).not.toHaveBeenCalled()
  })

  it('returns null when no outcome has valid biomarker deltas', async () => {
    mocks.outcomeFindMany.mockResolvedValue([
      makeOutcome('o1', []),
      makeOutcome('o2', []),
    ])
    const result = await fitPkProfile('user-1', 'rapamycin')
    expect(result).toBeNull()
  })

  it('fits a profile and upserts it when ≥ 2 valid outcomes exist', async () => {
    mocks.outcomeFindMany.mockResolvedValue([
      makeOutcome('o1', [-1.5, -0.8]),
      makeOutcome('o2', [-1.2, -0.6]),
    ])
    mocks.pkProfileUpsert.mockResolvedValue(FITTED_PROFILE)

    const result = await fitPkProfile('user-1', 'rapamycin')

    expect(result).not.toBeNull()
    expect(result!.source).toBe('fitted')
    expect(result!.userId).toBe('user-1')
    expect(result!.compoundId).toBe('rapamycin')
    expect(mocks.pkProfileUpsert).toHaveBeenCalledOnce()
  })

  it('includes all outcome IDs in fittedFromOutcomeIds', async () => {
    mocks.outcomeFindMany.mockResolvedValue([
      makeOutcome('outcome-a', [-1.0]),
      makeOutcome('outcome-b', [-1.5]),
      makeOutcome('outcome-c', [-0.8]),
    ])
    mocks.pkProfileUpsert.mockResolvedValue({ ...FITTED_PROFILE, n: 3 })

    await fitPkProfile('user-1', 'rapamycin')

    const upsertCall = mocks.pkProfileUpsert.mock.calls[0][0]
    // All 3 outcome IDs are passed in the create/update data
    expect(upsertCall.create.fittedFromOutcomeIds).toEqual(['outcome-a', 'outcome-b', 'outcome-c'])
  })

  it('returns null and logs error when DB throws', async () => {
    mocks.outcomeFindMany.mockRejectedValue(new Error('connection lost'))
    const result = await fitPkProfile('user-1', 'rapamycin')
    expect(result).toBeNull()
    expect(mocks.loggerError).toHaveBeenCalled()
  })
})

describe('getPkProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the fitted profile when one exists in DB', async () => {
    mocks.pkProfileFindUnique.mockResolvedValue(FITTED_PROFILE)
    const result = await getPkProfile('user-1', 'rapamycin')
    expect(result.source).toBe('fitted')
    expect(result.vd).toBe(50)
    expect(result.cl).toBe(5)
  })

  it('returns population defaults when no profile exists', async () => {
    mocks.pkProfileFindUnique.mockResolvedValue(null)
    const result = await getPkProfile('user-1', 'new-compound')
    expect(result.source).toBe('population_default')
    expect(result.vd).toBe(PK_POPULATION_DEFAULTS.vd)
    expect(result.cl).toBe(PK_POPULATION_DEFAULTS.cl)
    expect(result.n).toBe(0)
  })

  it('returns population defaults on DB error without throwing', async () => {
    mocks.pkProfileFindUnique.mockRejectedValue(new Error('timeout'))
    const result = await getPkProfile('user-1', 'rapamycin')
    expect(result.source).toBe('population_default')
    expect(mocks.loggerWarn).toHaveBeenCalled()
  })
})
