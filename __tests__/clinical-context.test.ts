import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { UserClinicalContext } from '@/lib/ai/clinical-context'

const mockDb = vi.hoisted(() => ({
  biomarker: { findMany: vi.fn() },
  protocol: { findMany: vi.fn() },
  medication: { findMany: vi.fn() },
  userProfile: { findUnique: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

import { buildUserClinicalContext, renderClinicalContextPrompt } from '@/lib/ai/clinical-context'

describe('buildUserClinicalContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('assembles biomarkers, protocols, medications, and profile', async () => {
    mockDb.biomarker.findMany.mockResolvedValue([
      { name: 'HbA1c', value: 5.4, unit: '%', measuredAt: new Date('2025-01-01') },
    ])
    mockDb.protocol.findMany.mockResolvedValue([
      { id: 'p1', name: 'Rapamycin Protocol', status: 'active', contraindicationScore: 0.1 },
    ])
    mockDb.medication.findMany.mockResolvedValue([
      { id: 'm1', name: 'Metformin', dosage: '500mg', frequency: 'daily', prescribedFor: 'longevity', active: true },
    ])
    mockDb.userProfile.findUnique.mockResolvedValue({
      supplementStack: '["NAD+","Omega-3"]',
      healthConditions: '["Prediabetes"]',
      longevityGoal: 'Healthspan extension',
      riskTolerance: 'moderate',
    })

    const ctx = await buildUserClinicalContext('user-1')

    expect(ctx.biomarkers).toHaveLength(1)
    expect(ctx.biomarkers[0].name).toBe('HbA1c')
    expect(ctx.protocols).toHaveLength(1)
    expect(ctx.medications).toHaveLength(1)
    expect(ctx.supplementStack).toEqual(['NAD+', 'Omega-3'])
    expect(ctx.healthConditions).toEqual(['Prediabetes'])
    expect(ctx.longevityGoal).toBe('Healthspan extension')
  })

  it('returns empty arrays when no data exists', async () => {
    mockDb.biomarker.findMany.mockResolvedValue([])
    mockDb.protocol.findMany.mockResolvedValue([])
    mockDb.medication.findMany.mockResolvedValue([])
    mockDb.userProfile.findUnique.mockResolvedValue(null)

    const ctx = await buildUserClinicalContext('user-2')

    expect(ctx.biomarkers).toEqual([])
    expect(ctx.protocols).toEqual([])
    expect(ctx.medications).toEqual([])
    expect(ctx.supplementStack).toEqual([])
    expect(ctx.healthConditions).toEqual([])
    expect(ctx.longevityGoal).toBeNull()
  })
})

describe('renderClinicalContextPrompt', () => {
  it('renders a non-empty prompt with biomarkers and medications', () => {
    const ctx: UserClinicalContext = {
      biomarkers: [{ name: 'CRP', value: 0.8, unit: 'mg/L', measuredAt: '2025-03-01T00:00:00.000Z' }],
      protocols: [{ id: 'p1', name: 'Metformin', status: 'active', contraindicationScore: 0.2 }],
      medications: [{ id: 'm1', name: 'Rapamycin', dosage: '2mg', frequency: 'weekly', prescribedFor: null, active: true }],
      supplementStack: ['Omega-3'],
      healthConditions: ['Type 2 Diabetes'],
      longevityGoal: 'Reduce biological age',
      riskTolerance: null,
    }

    const prompt = renderClinicalContextPrompt(ctx)

    expect(prompt).toContain('CRP: 0.8 mg/L')
    expect(prompt).toContain('Rapamycin 2mg (weekly)')
    expect(prompt).toContain('Metformin [active]')
    expect(prompt).toContain('Omega-3')
    expect(prompt).toContain('Type 2 Diabetes')
    expect(prompt).toContain('Reduce biological age')
    expect(prompt).toContain('do not prescribe or diagnose')
  })

  it('returns empty string when context is empty', () => {
    const ctx: UserClinicalContext = {
      biomarkers: [],
      protocols: [],
      medications: [],
      supplementStack: [],
      healthConditions: [],
      longevityGoal: null,
      riskTolerance: null,
    }

    expect(renderClinicalContextPrompt(ctx)).toBe('')
  })
})
