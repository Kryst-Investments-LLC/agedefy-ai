import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  medication: { findMany: vi.fn() },
  userProfile: { findUnique: vi.fn() },
  compound: { findMany: vi.fn() },
  compoundInteraction: { findMany: vi.fn() },
  clinicianTask: { create: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { checkUserInteractions } from '@/lib/safety/interaction-checker'

describe('checkUserInteractions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns no flags when user has fewer than 2 compounds', async () => {
    mockDb.medication.findMany.mockResolvedValue([{ name: 'Metformin' }])
    mockDb.userProfile.findUnique.mockResolvedValue(null)

    const result = await checkUserInteractions('u1', 'tenant1')

    expect(result.flags).toEqual([])
    expect(result.clinicianTaskIds).toEqual([])
  })

  it('returns no flags when no compounds resolve in knowledge graph', async () => {
    mockDb.medication.findMany.mockResolvedValue([{ name: 'Metformin' }, { name: 'Rapamycin' }])
    mockDb.userProfile.findUnique.mockResolvedValue(null)
    mockDb.compound.findMany.mockResolvedValue([])

    const result = await checkUserInteractions('u1', 'tenant1')

    expect(result.flags).toEqual([])
  })

  it('flags DANGEROUS interactions and creates priority-5 clinician task', async () => {
    mockDb.medication.findMany.mockResolvedValue([{ name: 'Drug A' }, { name: 'Drug B' }])
    mockDb.userProfile.findUnique.mockResolvedValue(null)
    mockDb.compound.findMany.mockResolvedValue([
      { id: 'c1', name: 'Drug A' },
      { id: 'c2', name: 'Drug B' },
    ])
    mockDb.compoundInteraction.findMany.mockResolvedValue([
      { compoundAId: 'c1', compoundBId: 'c2', severity: 'DANGEROUS', description: 'Severe hepatotoxicity' },
    ])
    mockDb.clinicianTask.create.mockResolvedValue({ id: 'task-1' })

    const result = await checkUserInteractions('u1', 'tenant1')

    expect(result.flags).toHaveLength(1)
    expect(result.flags[0].severity).toBe('DANGEROUS')
    expect(result.clinicianTaskIds).toEqual(['task-1'])

    expect(mockDb.clinicianTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority: 5,
          status: 'PENDING',
        }),
      }),
    )
  })

  it('flags CAUTION interactions and creates priority-3 clinician task', async () => {
    mockDb.medication.findMany.mockResolvedValue([{ name: 'Drug A' }])
    mockDb.userProfile.findUnique.mockResolvedValue({
      supplementStack: '["Supplement X"]',
    })
    mockDb.compound.findMany.mockResolvedValue([
      { id: 'c1', name: 'Drug A' },
      { id: 'c2', name: 'Supplement X' },
    ])
    mockDb.compoundInteraction.findMany.mockResolvedValue([
      { compoundAId: 'c1', compoundBId: 'c2', severity: 'CAUTION', description: 'May reduce efficacy' },
    ])
    mockDb.clinicianTask.create.mockResolvedValue({ id: 'task-2' })

    const result = await checkUserInteractions('u1', 'tenant1')

    expect(result.flags).toHaveLength(1)
    expect(result.flags[0].severity).toBe('CAUTION')
    expect(result.clinicianTaskIds).toEqual(['task-2'])

    expect(mockDb.clinicianTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: 3 }),
      }),
    )
  })

  it('ignores NEUTRAL and BENEFICIAL interactions', async () => {
    mockDb.medication.findMany.mockResolvedValue([{ name: 'Drug A' }, { name: 'Drug B' }])
    mockDb.userProfile.findUnique.mockResolvedValue(null)
    mockDb.compound.findMany.mockResolvedValue([
      { id: 'c1', name: 'Drug A' },
      { id: 'c2', name: 'Drug B' },
    ])
    mockDb.compoundInteraction.findMany.mockResolvedValue([
      { compoundAId: 'c1', compoundBId: 'c2', severity: 'NEUTRAL', description: null },
    ])

    const result = await checkUserInteractions('u1', 'tenant1')

    expect(result.flags).toEqual([])
    expect(result.clinicianTaskIds).toEqual([])
    expect(mockDb.clinicianTask.create).not.toHaveBeenCalled()
  })
})
