import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  db: {
    agentClaim: {
      findMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'bundle-claim' }),
    },
  },
}))
vi.mock('@/lib/db', () => mockDb)

import { ExplainabilityAgent } from '@/lib/agents/explainability-agent'
import { Scratchpad } from '@/lib/agents/scratchpad'
import { createTraceEmitter, getTraceHistory } from '@/lib/agents/trace-emitter'
import type { AgentExecutionContext, AgentStep } from '@/lib/agents/types'

const stubLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as AgentExecutionContext['logger']

const step: AgentStep = {
  index: 0,
  agentClass: 'explainability',
  description: 'summarize',
  toolCalls: [],
  expectedOutputKeys: ['explainability.summary'],
  status: 'running',
}

function makeContext(sessionId: string): AgentExecutionContext {
  const scratchpad = new Scratchpad()
  // Two sections (perception trend + safety warnings) so the citation branch runs.
  scratchpad.write(
    'perception.snapshot',
    {
      biomarkerSummary: [{ name: 'HbA1c', latestValue: 6.2, unit: '%', trend: 'UP', isAnomaly: false }],
      activeMedications: [],
      activeProtocols: [],
      supplementStack: [],
      anomalies: [],
    },
    'perception',
  )
  scratchpad.write('safety.flags', [], 'safety')

  return {
    sessionId,
    userId: 'u1',
    tenantId: 't1',
    clinicalContext: {
      biomarkers: [],
      protocols: [],
      medications: [],
      supplementStack: [],
      healthConditions: [],
      longevityGoal: null,
      riskTolerance: null,
    },
    scratchpad,
    logger: stubLogger,
    emitTrace: createTraceEmitter(sessionId),
  }
}

beforeEach(() => {
  mockDb.db.agentClaim.findMany.mockReset()
  mockDb.db.agentClaim.create.mockResolvedValue({ id: 'bundle-claim' })
})

describe('ExplainabilityAgent emits citation evidence', () => {
  it('maps upstream AgentClaims into structured citations with aggregate confidence', async () => {
    mockDb.db.agentClaim.findMany.mockResolvedValue([
      { agentClass: 'safety', claimText: 'DDI phenelzine × sertraline', evidenceKind: 'KNOWLEDGE_GRAPH_EDGE', evidenceRef: 'ci:1', confidence: 0.9 },
      { agentClass: 'protocol', claimText: 'NMN supports NAD+', evidenceKind: 'COHORT_STATISTIC', evidenceRef: 'co:2', confidence: 0.7 },
    ])

    const sessionId = `sess-${crypto.randomUUID()}`
    await new ExplainabilityAgent().execute(step, makeContext(sessionId))

    const ev = getTraceHistory(sessionId).find(
      (e) => e.kind === 'evidence' && e.agentClass === 'explainability',
    )
    expect(ev).toBeDefined()
    expect(ev!.evidence?.citations).toHaveLength(2)
    expect(ev!.evidence?.citations?.[0].source).toContain('safety')
    expect(ev!.evidence?.confidence).toBeCloseTo(0.8) // mean of 0.9 and 0.7
    expect(ev!.evidence?.reasoningRef).toBe(`agent-session:${sessionId}`)
  })

  it('emits an uncited-evidence event (0 citations, 0 confidence) when no claims exist', async () => {
    mockDb.db.agentClaim.findMany.mockResolvedValue([])

    const sessionId = `sess-${crypto.randomUUID()}`
    await new ExplainabilityAgent().execute(step, makeContext(sessionId))

    const ev = getTraceHistory(sessionId).find(
      (e) => e.kind === 'evidence' && e.agentClass === 'explainability',
    )
    expect(ev).toBeDefined()
    expect(ev!.evidence?.citations).toHaveLength(0)
    expect(ev!.evidence?.confidence).toBe(0)
    expect(ev!.message).toContain('NO upstream citations')
  })
})
