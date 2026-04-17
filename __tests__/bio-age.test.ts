import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock db before importing the module
vi.mock('@/lib/db', () => ({
  db: {
    biomarker: {
      findMany: vi.fn().mockResolvedValue([
        { name: 'glucose', value: 95, unit: 'mg/dL', date: new Date() },
        { name: 'HbA1c', value: 5.2, unit: '%', date: new Date() },
        { name: 'CRP', value: 0.8, unit: 'mg/L', date: new Date() },
        { name: 'LDL', value: 110, unit: 'mg/dL', date: new Date() },
        { name: 'HDL', value: 55, unit: 'mg/dL', date: new Date() },
      ]),
    },
    biologicalAgeSnapshot: {
      create: vi.fn().mockResolvedValue({ id: 'snap_123' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

// Mock AI config — disable all providers so AI calls are never attempted
vi.mock('@/lib/config/ai-config', () => ({
  getAIConfig: () => ({
    providers: {
      openai: { enabled: false, apiKey: '', model: 'gpt-4' },
      anthropic: { enabled: false, apiKey: '', model: 'claude-3' },
      grok: { enabled: false, apiKey: '', model: 'grok-1' },
    },
  }),
  isProviderEnabled: () => false,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('bio-age module exports', () => {
  it('exports computeBiologicalAge and computeAndPersistBioAge', async () => {
    const mod = await import('@/lib/bio-age/compute-bio-age')
    expect(typeof mod.computeBiologicalAge).toBe('function')
    expect(typeof mod.computeAndPersistBioAge).toBe('function')
  })
})

describe('computeBiologicalAge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a fallback when no AI provider is configured', async () => {
    const { computeBiologicalAge } = await import('@/lib/bio-age/compute-bio-age')
    // With no providers enabled, it should throw
    await expect(computeBiologicalAge('user_1', 35)).rejects.toThrow('No AI provider is configured')
  })

  it('returns fallback result when no biomarkers exist', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.biomarker.findMany).mockResolvedValueOnce([])

    const { computeBiologicalAge } = await import('@/lib/bio-age/compute-bio-age')
    const result = await computeBiologicalAge('user_no_data', 42)
    
    expect(result.chronologicalAge).toBe(42)
    expect(result.biologicalAge).toBe(42)
    expect(result.delta).toBe(0)
    expect(result.confidence).toBe(0)
  })
})

describe('BioAgeResult shape', () => {
  it('has all expected hallmark keys', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.biomarker.findMany).mockResolvedValueOnce([])

    const { computeBiologicalAge } = await import('@/lib/bio-age/compute-bio-age')
    const result = await computeBiologicalAge('user_shape', 30)

    const expectedKeys = [
      'genomicInstability',
      'telomereDysfunction',
      'epigeneticAlteration',
      'lossOfProteostasis',
      'disabledMacroautophagy',
      'mitochondrialDysfunction',
      'cellularSenescence',
      'stemCellExhaustion',
      'alteredIntercellularCommunication',
    ]
    for (const key of expectedKeys) {
      expect(result.hallmarkScores).toHaveProperty(key)
      expect(typeof result.hallmarkScores[key as keyof typeof result.hallmarkScores]).toBe('number')
    }
  })
})

describe('computeAndPersistBioAge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists snapshot to database on success', async () => {
    const { db } = await import('@/lib/db')
    // Return empty biomarkers so we get fallback (no AI call needed)
    vi.mocked(db.biomarker.findMany).mockResolvedValueOnce([])

    const { computeAndPersistBioAge } = await import('@/lib/bio-age/compute-bio-age')
    const result = await computeAndPersistBioAge('user_persist', 45)

    expect(result.snapshotId).toBe('snap_123')
    expect(db.biologicalAgeSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_persist',
        chronologicalAge: 45,
        biologicalAge: 45,
        tenantId: 'default',
      }),
    })
  })
})
