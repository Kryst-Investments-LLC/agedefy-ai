import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// clinical-planning-agent — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  getAIConfig: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('@/lib/config/ai-config', () => ({
  getAIConfig: mocks.getAIConfig,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: mocks.loggerError },
}))

import {
  runClinicalPlanningAgent,
  PLAN_DISCLAIMER,
} from '@/lib/agents/clinical-planning-agent'

const NO_LLM = {
  providers: { anthropic: { enabled: false, apiKey: undefined, model: 'claude-sonnet-4-6' } },
}

const BASE_SNAPSHOT = {
  dysregulatedPathways: ['NF-kB / Inflammation', 'Insulin Resistance / mTOR'],
  activeProtocolId: 'proto-1',
  protocolWeeksActive: 4,
  biomarkersJson: { crp: { value: 5.0, unit: 'mg/L' }, hba1c: { value: 6.2, unit: '%' } },
}

describe('runClinicalPlanningAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAIConfig.mockReturnValue(NO_LLM)
  })

  it('returns an InvestigationPlan with the disclaimer in the rationale', async () => {
    const plan = await runClinicalPlanningAgent(BASE_SNAPSHOT, [])
    expect(plan.rationale).toContain(PLAN_DISCLAIMER)
  })

  it('always includes safety agent in the sequence', async () => {
    const plan = await runClinicalPlanningAgent(BASE_SNAPSHOT, [])
    const hasSafety = plan.agentSequence.some((s) => s.agentClass === 'safety')
    expect(hasSafety).toBe(true)
  })

  it('always includes perception agent first', async () => {
    const plan = await runClinicalPlanningAgent(BASE_SNAPSHOT, [])
    expect(plan.agentSequence[0].agentClass).toBe('perception')
  })

  it('includes protocol agent when activeProtocolId is set', async () => {
    const plan = await runClinicalPlanningAgent(BASE_SNAPSHOT, [])
    const hasProtocol = plan.agentSequence.some((s) => s.agentClass === 'protocol')
    expect(hasProtocol).toBe(true)
  })

  it('skips protocol agent when no active protocol', async () => {
    const snapshot = { ...BASE_SNAPSHOT, activeProtocolId: null }
    const plan = await runClinicalPlanningAgent(snapshot, [])
    const hasProtocol = plan.agentSequence.some((s) => s.agentClass === 'protocol')
    expect(hasProtocol).toBe(false)
    expect(plan.skipAgents).toContain('protocol')
  })

  it('sets priorityPathways from the snapshot', async () => {
    const plan = await runClinicalPlanningAgent(BASE_SNAPSHOT, [])
    expect(plan.priorityPathways).toContain('NF-kB / Inflammation')
    expect(plan.priorityPathways).toContain('Insulin Resistance / mTOR')
  })

  it('confidence is "low" when no pathways are dysregulated', async () => {
    const snapshot = { ...BASE_SNAPSHOT, dysregulatedPathways: [], activeProtocolId: null }
    const plan = await runClinicalPlanningAgent(snapshot, [])
    expect(plan.confidence).toBe('low')
  })

  it('confidence is "medium" when twin accuracy delta is negative', async () => {
    const reflections = [{ insights: [], twinAccuracyDelta: -0.15 }]
    const plan = await runClinicalPlanningAgent(BASE_SNAPSHOT, reflections)
    expect(plan.confidence).toBe('medium')
  })

  it('confidence is "high" when pathways exist and accuracy is not degrading', async () => {
    const reflections = [{ insights: [], twinAccuracyDelta: 0.05 }]
    const plan = await runClinicalPlanningAgent(BASE_SNAPSHOT, reflections)
    expect(plan.confidence).toBe('high')
  })

  it('returns fallback plan on internal error (no throw)', async () => {
    const badSnapshot = null as unknown as typeof BASE_SNAPSHOT
    const plan = await runClinicalPlanningAgent(badSnapshot, [])
    expect(plan.confidence).toBe('low')
    expect(plan.agentSequence.some((s) => s.agentClass === 'safety')).toBe(true)
  })
})
