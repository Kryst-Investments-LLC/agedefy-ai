import { describe, expect, it } from 'vitest'

import { PerceptionAgent } from '@/lib/agents/perception-agent'
import { Scratchpad } from '@/lib/agents/scratchpad'
import { createTraceEmitter, getTraceHistory } from '@/lib/agents/trace-emitter'
import type { AgentExecutionContext, AgentStep } from '@/lib/agents/types'

const stubLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as AgentExecutionContext['logger']

function makeContext(sessionId: string): AgentExecutionContext {
  return {
    sessionId,
    userId: 'u1',
    tenantId: 't1',
    clinicalContext: {
      // Two HbA1c readings → a clear UP trend the inputs evidence should capture.
      biomarkers: [
        { name: 'HbA1c', value: 5.4, unit: '%', measuredAt: '2026-01-01T00:00:00Z' },
        { name: 'HbA1c', value: 6.2, unit: '%', measuredAt: '2026-02-01T00:00:00Z' },
      ],
      protocols: [],
      medications: [],
      supplementStack: [],
      healthConditions: [],
      longevityGoal: null,
      riskTolerance: null,
    },
    scratchpad: new Scratchpad(),
    logger: stubLogger,
    emitTrace: createTraceEmitter(sessionId),
  }
}

const step: AgentStep = {
  index: 0,
  agentClass: 'perception',
  description: 'gather inputs',
  toolCalls: [],
  expectedOutputKeys: ['perception.snapshot'],
  status: 'running',
}

describe('PerceptionAgent emits structured input evidence', () => {
  it('records the biomarkers it reasoned from in a queryable evidence event', async () => {
    const sessionId = `sess-${crypto.randomUUID()}`
    const ctx = makeContext(sessionId)

    await new PerceptionAgent().execute(step, ctx)

    const evidenceEvents = getTraceHistory(sessionId).filter(
      (e) => e.kind === 'evidence' && e.agentClass === 'perception',
    )
    expect(evidenceEvents).toHaveLength(1)

    const inputs = evidenceEvents[0].evidence?.inputs as {
      biomarkers?: { name: string; trend: string }[]
    }
    expect(inputs?.biomarkers?.[0]).toMatchObject({ name: 'HbA1c', trend: 'UP' })
  })
})
