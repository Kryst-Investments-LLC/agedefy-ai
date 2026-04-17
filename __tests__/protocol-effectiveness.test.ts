import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  protocol: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  biomarker: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

import { computeProtocolEffectiveness, computeUserProtocolEffectiveness } from '@/lib/analytics/protocol-effectiveness'

describe('computeProtocolEffectiveness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for non-existent protocol', async () => {
    mockDb.protocol.findUnique.mockResolvedValue(null)

    const result = await computeProtocolEffectiveness('nonexistent')

    expect(result).toBeNull()
  })

  it('computes score with favorable biomarker deltas', async () => {
    const protocolStart = new Date('2025-01-01T00:00:00Z')

    mockDb.protocol.findUnique.mockResolvedValue({
      id: 'p1',
      name: 'Metformin Protocol',
      status: 'active',
      userId: 'u1',
      createdAt: protocolStart,
    })

    // hba1c: lower is better → baseline 6.5 → latest 5.8 → favorable
    // ldl: lower is better → baseline 130 → latest 110 → favorable
    mockDb.biomarker.findMany.mockResolvedValue([
      // Baseline entries (within 14 days of protocol start)
      { name: 'hba1c', value: 6.5, measuredAt: new Date('2025-01-02T00:00:00Z') },
      { name: 'ldl', value: 130, measuredAt: new Date('2025-01-03T00:00:00Z') },
      // Follow-up entries (within evaluation window 76-90 days)
      { name: 'hba1c', value: 5.8, measuredAt: new Date('2025-03-20T00:00:00Z') },
      { name: 'ldl', value: 110, measuredAt: new Date('2025-03-25T00:00:00Z') },
    ])

    const result = await computeProtocolEffectiveness('p1')

    expect(result).not.toBeNull()
    expect(result!.protocolId).toBe('p1')
    expect(result!.evaluatedBiomarkers).toBe(2)
    expect(result!.favorableBiomarkers).toBe(2)
    expect(result!.score).toBe(1) // 2/2 favorable
    expect(result!.deltas).toHaveLength(2)
    expect(result!.deltas.every((d) => d.favorable)).toBe(true)
  })

  it('handles mixed favorable and unfavorable deltas', async () => {
    const protocolStart = new Date('2025-01-01T00:00:00Z')

    mockDb.protocol.findUnique.mockResolvedValue({
      id: 'p2',
      name: 'Test Protocol',
      status: 'active',
      userId: 'u1',
      createdAt: protocolStart,
    })

    mockDb.biomarker.findMany.mockResolvedValue([
      // crp: lower is better → baseline 2.0 → latest 3.0 → unfavorable (went up)
      { name: 'crp', value: 2.0, measuredAt: new Date('2025-01-02T00:00:00Z') },
      { name: 'crp', value: 3.0, measuredAt: new Date('2025-03-20T00:00:00Z') },
      // ldl: lower is better → baseline 140 → latest 120 → favorable
      { name: 'ldl', value: 140, measuredAt: new Date('2025-01-02T00:00:00Z') },
      { name: 'ldl', value: 120, measuredAt: new Date('2025-03-20T00:00:00Z') },
    ])

    const result = await computeProtocolEffectiveness('p2')

    expect(result!.evaluatedBiomarkers).toBe(2)
    expect(result!.favorableBiomarkers).toBe(1)
    expect(result!.score).toBe(0.5)
  })

  it('returns zero score when no biomarker data matches windows', async () => {
    mockDb.protocol.findUnique.mockResolvedValue({
      id: 'p3',
      name: 'Empty Protocol',
      status: 'active',
      userId: 'u1',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    })
    mockDb.biomarker.findMany.mockResolvedValue([])

    const result = await computeProtocolEffectiveness('p3')

    expect(result!.score).toBe(0)
    expect(result!.evaluatedBiomarkers).toBe(0)
    expect(result!.confidence).toBe(0)
  })
})

describe('computeUserProtocolEffectiveness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes effectiveness for all user protocols', async () => {
    mockDb.protocol.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])

    mockDb.protocol.findUnique
      .mockResolvedValueOnce({
        id: 'p1',
        name: 'Protocol A',
        status: 'active',
        userId: 'u1',
        createdAt: new Date('2025-01-01'),
      })
      .mockResolvedValueOnce({
        id: 'p2',
        name: 'Protocol B',
        status: 'active',
        userId: 'u1',
        createdAt: new Date('2025-01-01'),
      })

    mockDb.biomarker.findMany.mockResolvedValue([])

    const results = await computeUserProtocolEffectiveness('u1')

    expect(results).toHaveLength(2)
  })
})
