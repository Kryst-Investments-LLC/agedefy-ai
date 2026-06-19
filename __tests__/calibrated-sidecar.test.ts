import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// calibrated-sidecar — unit tests for sendUserPkProfile and
// requestCalibratedSimulation in lib/sidecars.ts
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  requestFn: vi.fn(),
  mechanisticConfigured: vi.fn(),
}))

// We test the exported functions by mocking the internal `request` helper
// and `mechanisticSidecar.configured`.
vi.mock('@/lib/sidecars', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sidecars')>()
  return {
    ...actual,
    mechanisticSidecar: {
      ...actual.mechanisticSidecar,
      configured: mocks.mechanisticConfigured,
    },
  }
})

// Test sendUserPkProfile and requestCalibratedSimulation behaviour
// by exercising them through the module.
import { sendUserPkProfile, requestCalibratedSimulation, SidecarError } from '@/lib/sidecars'

const PK_PARAMS = { vd: 50, cl: 5, ka: 1.0, f: 0.7, n: 3, rmse: 0.04 }

describe('sendUserPkProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is a no-op when sidecar is not configured', async () => {
    mocks.mechanisticConfigured.mockReturnValue(false)
    // Should resolve without error; no HTTP call
    await expect(sendUserPkProfile('user-1', 'rapamycin', PK_PARAMS)).resolves.toBeUndefined()
  })
})

describe('requestCalibratedSimulation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws SidecarError when sidecar is not configured', async () => {
    mocks.mechanisticConfigured.mockReturnValue(false)

    await expect(
      requestCalibratedSimulation({
        baseline: {},
        interventions: [],
        horizon_weeks: 12,
        outcomes: ['CRP'],
        userPkParams: { userId: 'user-1', compoundId: 'rapamycin', ...PK_PARAMS },
      }),
    ).rejects.toThrow('not configured')
  })
})
