import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// reflection-agent — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  cycleFind: vi.fn(),
  reportFind: vi.fn(),
  reportCreate: vi.fn(),
  cycleUpdate: vi.fn(),
  signResultSafe: vi.fn(),
  updateEffectPrior: vi.fn(),
  anthropicFetch: vi.fn(),
  getAIConfig: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    loopCycle: { findUnique: mocks.cycleFind, update: mocks.cycleUpdate },
    reflectionReport: { findUnique: mocks.reportFind, create: mocks.reportCreate },
  },
}))

vi.mock('@/lib/provenance/sign-result', () => ({
  signResultSafe: mocks.signResultSafe,
}))

vi.mock('@/lib/agents/twin-priors', () => ({
  updateEffectPrior: mocks.updateEffectPrior,
}))

vi.mock('@/lib/config/ai-config', () => ({
  getAIConfig: mocks.getAIConfig,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { runReflectionAgent, REFLECTION_DISCLAIMER } from '@/lib/agents/reflection-agent'

const BASE_CYCLE = {
  id: 'cycle-1',
  userId: 'user-1',
  tenantId: 'default',
  status: 'REFLECT',
  protocolOutcome: {
    id: 'outcome-1',
    targetBiomarkers: [
      { name: 'CRP', predictedDelta: -2.0, predictedDirection: 'down' },
    ],
    observedBiomarkers: [
      { name: 'CRP', observedDelta: -1.8, observedDirection: 'down', confidence: 0.9 },
    ],
    twinPredictionAccuracy: 0.7,
  },
}

describe('runReflectionAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.reportFind.mockResolvedValue(null) // no existing report
    mocks.reportCreate.mockResolvedValue({ id: 'report-1' })
    mocks.signResultSafe.mockResolvedValue({ '@context': 'https://w3.org/vc', type: 'VerifiableCredential' })
    mocks.updateEffectPrior.mockResolvedValue(undefined)
    mocks.getAIConfig.mockReturnValue({
      providers: { anthropic: { enabled: false, apiKey: undefined, model: 'claude-sonnet-4-6' } },
    })
  })

  it('returns null when cycle is not found', async () => {
    mocks.cycleFind.mockResolvedValue(null)
    const result = await runReflectionAgent({ loopCycleId: 'missing', userId: 'user-1', tenantId: 'default' })
    expect(result).toBeNull()
  })

  it('returns null when a report already exists (idempotent)', async () => {
    mocks.cycleFind.mockResolvedValue(BASE_CYCLE)
    mocks.reportFind.mockResolvedValue({ id: 'existing-report' })
    const result = await runReflectionAgent({ loopCycleId: 'cycle-1', userId: 'user-1', tenantId: 'default' })
    expect(result).toBeNull()
    expect(mocks.reportCreate).not.toHaveBeenCalled()
  })

  it('creates a report with fallback insights when Anthropic is disabled', async () => {
    mocks.cycleFind.mockResolvedValue(BASE_CYCLE)

    const result = await runReflectionAgent({ loopCycleId: 'cycle-1', userId: 'user-1', tenantId: 'default' })

    expect(result).not.toBeNull()
    expect(result?.reportId).toBe('report-1')
    expect(result?.disclaimer).toBe(REFLECTION_DISCLAIMER)
    expect(Array.isArray(result?.insights)).toBe(true)
    expect(result!.insights.length).toBeGreaterThan(0)
  })

  it('computes twinAccuracyDelta relative to 0.5 baseline', async () => {
    mocks.cycleFind.mockResolvedValue(BASE_CYCLE) // twinPredictionAccuracy = 0.7

    const result = await runReflectionAgent({ loopCycleId: 'cycle-1', userId: 'user-1', tenantId: 'default' })

    // 0.7 - 0.5 = 0.2
    expect(result?.twinAccuracyDelta).toBeCloseTo(0.2, 5)
  })

  it('signs the report with the provenance rail', async () => {
    mocks.cycleFind.mockResolvedValue(BASE_CYCLE)

    const result = await runReflectionAgent({ loopCycleId: 'cycle-1', userId: 'user-1', tenantId: 'default' })

    expect(mocks.signResultSafe).toHaveBeenCalledWith(
      expect.objectContaining({ resultType: 'ReflectionReport', validationStatus: 'ai_generated_hypothesis' }),
    )
    expect(result?.signedVc).toBeDefined()
  })

  it('calls updateEffectPrior for each prior adjustment', async () => {
    // Cycle with one target biomarker → expect one prior adjustment
    mocks.cycleFind.mockResolvedValue(BASE_CYCLE)

    await runReflectionAgent({ loopCycleId: 'cycle-1', userId: 'user-1', tenantId: 'default' })

    // priorAdjustments should be non-empty when observed biomarkers exist
    expect(mocks.updateEffectPrior).toHaveBeenCalled()
  })

  it('returns null (does not throw) on unexpected DB error', async () => {
    mocks.cycleFind.mockRejectedValue(new Error('connection refused'))
    const result = await runReflectionAgent({ loopCycleId: 'cycle-1', userId: 'user-1', tenantId: 'default' })
    expect(result).toBeNull()
  })
})
