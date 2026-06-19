import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// outcome-writer — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  cycleFind: vi.fn(),
  biomarkerFindMany: vi.fn(),
  biomarkerFindFirst: vi.fn(),
  outcomeCreate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    loopCycle: { findUnique: mocks.cycleFind },
    biomarker: { findMany: mocks.biomarkerFindMany, findFirst: mocks.biomarkerFindFirst },
    protocolOutcome: { create: mocks.outcomeCreate },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { writeProtocolOutcome } from '@/lib/loop/outcome-writer'

const START = new Date('2026-06-01T00:00:00Z')
const BASE_CYCLE = {
  id: 'cycle-1',
  userId: 'user-1',
  tenantId: 'default',
  startedAt: START,
  snapshot: { activeProtocolId: 'proto-1' },
  protocolOutcome: null,
}

describe('writeProtocolOutcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.outcomeCreate.mockResolvedValue({ id: 'outcome-1' })
  })

  it('returns null when cycle is not found', async () => {
    mocks.cycleFind.mockResolvedValue(null)
    const result = await writeProtocolOutcome('missing-cycle')
    expect(result).toBeNull()
    expect(mocks.outcomeCreate).not.toHaveBeenCalled()
  })

  it('returns existing outcome id when already written (idempotent)', async () => {
    mocks.cycleFind.mockResolvedValue({
      ...BASE_CYCLE,
      protocolOutcome: { id: 'outcome-already' },
    })
    const result = await writeProtocolOutcome('cycle-1')
    expect(result?.id).toBe('outcome-already')
    expect(mocks.outcomeCreate).not.toHaveBeenCalled()
  })

  it('writes an outcome with no biomarkers when there are no readings', async () => {
    mocks.cycleFind.mockResolvedValue(BASE_CYCLE)
    mocks.biomarkerFindMany.mockResolvedValue([])

    const result = await writeProtocolOutcome('cycle-1')
    expect(result?.id).toBe('outcome-1')
    expect(mocks.outcomeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loopCycleId: 'cycle-1',
          protocolId: 'proto-1',
          observedBiomarkers: [],
        }),
      }),
    )
  })

  it('computes correct delta and direction for a decreasing biomarker', async () => {
    mocks.cycleFind.mockResolvedValue(BASE_CYCLE)
    // After readings
    mocks.biomarkerFindMany.mockResolvedValue([
      { name: 'CRP', value: 2.0, measuredAt: new Date('2026-06-10T00:00:00Z') },
    ])
    // Before readings (for delta)
    mocks.biomarkerFindMany.mockResolvedValueOnce([
      { name: 'CRP', value: 2.0, measuredAt: new Date('2026-06-10T00:00:00Z') },
    ]).mockResolvedValueOnce([
      { name: 'CRP', value: 4.0, measuredAt: new Date('2026-05-01T00:00:00Z') },
    ])

    await writeProtocolOutcome('cycle-1')

    const outcomeData = mocks.outcomeCreate.mock.calls[0][0].data
    const obs = outcomeData.observedBiomarkers as Array<{ name: string; observedDelta: number; observedDirection: string }>
    const crp = obs.find((o) => o.name === 'CRP')
    expect(crp?.observedDelta).toBe(-2.0)
    expect(crp?.observedDirection).toBe('down')
  })

  it('returns null (does not throw) when DB call throws', async () => {
    mocks.cycleFind.mockRejectedValue(new Error('connection refused'))
    const result = await writeProtocolOutcome('cycle-1')
    expect(result).toBeNull()
  })
})
