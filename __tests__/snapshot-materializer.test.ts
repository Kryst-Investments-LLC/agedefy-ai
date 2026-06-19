import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// snapshot-materializer — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  biomarkerFindMany: vi.fn(),
  protocolFindFirst: vi.fn(),
  twinFindUnique: vi.fn(),
  simFindFirst: vi.fn(),
  snapshotCreate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    biomarker: { findMany: mocks.biomarkerFindMany },
    protocol: { findFirst: mocks.protocolFindFirst },
    physiologicalTwin: { findUnique: mocks.twinFindUnique },
    twinSimulationRun: { findFirst: mocks.simFindFirst },
    physiologicalSnapshot: { create: mocks.snapshotCreate },
  },
}))

import { materializeSnapshot } from '@/lib/loop/snapshot-materializer'

const NOW = new Date('2026-06-19T00:00:00Z')

describe('materializeSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.snapshotCreate.mockResolvedValue({ id: 'snap-1' })
  })

  it('returns the created snapshot id on success', async () => {
    mocks.biomarkerFindMany.mockResolvedValue([])
    mocks.protocolFindFirst.mockResolvedValue(null)
    mocks.twinFindUnique.mockResolvedValue(null)
    mocks.simFindFirst.mockResolvedValue(null)

    const result = await materializeSnapshot('user-1', 'tenant-1')
    expect(result).toEqual({ id: 'snap-1' })
  })

  it('returns null when the DB call throws', async () => {
    mocks.biomarkerFindMany.mockRejectedValue(new Error('connection refused'))

    const result = await materializeSnapshot('user-1', 'tenant-1')
    expect(result).toBeNull()
  })

  it('deduplicates biomarkers — keeps only the first (latest) reading per name', async () => {
    const measuredAt1 = new Date('2026-06-19T00:00:00Z')
    const measuredAt2 = new Date('2026-06-18T00:00:00Z')
    mocks.biomarkerFindMany.mockResolvedValue([
      { name: 'CRP', value: 5.0, unit: 'mg/L', trend: 'UP', measuredAt: measuredAt1 },
      { name: 'CRP', value: 3.0, unit: 'mg/L', trend: 'STABLE', measuredAt: measuredAt2 },
    ])
    mocks.protocolFindFirst.mockResolvedValue(null)
    mocks.twinFindUnique.mockResolvedValue(null)
    mocks.simFindFirst.mockResolvedValue(null)

    await materializeSnapshot('user-1', 'tenant-1')

    const createCall = mocks.snapshotCreate.mock.calls[0][0]
    const biomarkersJson = createCall.data.biomarkersJson as Record<string, { value: number }>
    // Only one CRP entry, and it should be the first (most recent) one
    const crpKeys = Object.keys(biomarkersJson).filter((k) => k === 'CRP')
    expect(crpKeys).toHaveLength(1)
    expect(biomarkersJson['CRP'].value).toBe(5.0)
  })

  it('populates activeProtocolId and protocolWeeksActive when a protocol is active', async () => {
    mocks.biomarkerFindMany.mockResolvedValue([])
    mocks.protocolFindFirst.mockResolvedValue({
      id: 'proto-1',
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      status: 'active',
    })
    mocks.twinFindUnique.mockResolvedValue(null)
    mocks.simFindFirst.mockResolvedValue(null)

    await materializeSnapshot('user-1', 'tenant-1')

    const data = mocks.snapshotCreate.mock.calls[0][0].data
    expect(data.activeProtocolId).toBe('proto-1')
    expect(data.protocolWeeksActive).toBeCloseTo(2, 0)
  })

  it('sets twinLastSimAt from simulation when available', async () => {
    const simAt = new Date('2026-06-15T12:00:00Z')
    mocks.biomarkerFindMany.mockResolvedValue([])
    mocks.protocolFindFirst.mockResolvedValue(null)
    mocks.twinFindUnique.mockResolvedValue({ updatedAt: NOW })
    mocks.simFindFirst.mockResolvedValue({ createdAt: simAt, predictedMean: 0.8, endpoint: 'GrimAge_delta' })

    await materializeSnapshot('user-1', 'tenant-1')

    const data = mocks.snapshotCreate.mock.calls[0][0].data
    expect(data.twinLastSimAt).toEqual(simAt)
  })

  it('populates dysregulatedPathways from classifier', async () => {
    mocks.biomarkerFindMany.mockResolvedValue([
      { name: 'hs-CRP', value: 6.0, unit: 'mg/L', trend: 'UP', measuredAt: NOW },
    ])
    mocks.protocolFindFirst.mockResolvedValue(null)
    mocks.twinFindUnique.mockResolvedValue(null)
    mocks.simFindFirst.mockResolvedValue(null)

    await materializeSnapshot('user-1', 'tenant-1')

    const data = mocks.snapshotCreate.mock.calls[0][0].data
    expect(data.dysregulatedPathways).toContain('NF-kB / Inflammation')
  })
})
