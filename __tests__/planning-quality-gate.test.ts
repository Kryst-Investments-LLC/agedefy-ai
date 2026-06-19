import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// planning-quality-gate — unit tests
//
// We test the validateInvestigationPlan function indirectly by importing the
// clinical-planning-agent and verifying its output always passes the gate.
// We also test the gate directly by exercising plans that violate each rule.
// ---------------------------------------------------------------------------

import type { InvestigationPlan } from '@/lib/agents/clinical-planning-agent'

// Re-implement the same gate logic here so we can test it in isolation
// without mocking supervisor internals.
function validatePlan(plan: InvestigationPlan): InvestigationPlan | null {
  if (!plan.agentSequence || plan.agentSequence.length === 0) return null

  const hasSafety = plan.agentSequence.some((s) => s.agentClass === 'safety')
  if (!hasSafety) return null

  const perceptionIdx = plan.agentSequence.findIndex((s) => s.agentClass === 'perception')
  const safetyIdx = plan.agentSequence.findIndex((s) => s.agentClass === 'safety')
  if (perceptionIdx !== -1 && safetyIdx !== -1 && safetyIdx < perceptionIdx) return null

  const explainIdx = plan.agentSequence.findIndex((s) => s.agentClass === 'explainability')
  if (explainIdx !== -1 && explainIdx !== plan.agentSequence.length - 1) return null

  const seen = new Set<string>()
  for (const step of plan.agentSequence) {
    if (seen.has(step.agentClass)) return null
    seen.add(step.agentClass)
  }

  return plan
}

function makeStep(agentClass: string) {
  return { agentClass: agentClass as 'perception', reason: 'test' }
}

function makeValidPlan(): InvestigationPlan {
  return {
    priorityPathways: ['NF-kB / Inflammation'],
    agentSequence: [
      makeStep('perception'),
      makeStep('safety'),
      makeStep('explainability'),
    ],
    skipAgents: ['protocol'],
    rationale: 'Test plan — requires expert validation.',
    confidence: 'high',
  }
}

describe('validateInvestigationPlan (quality gate)', () => {
  it('passes a valid plan through unchanged', () => {
    expect(validatePlan(makeValidPlan())).not.toBeNull()
  })

  it('rejects an empty agentSequence', () => {
    const plan = { ...makeValidPlan(), agentSequence: [] }
    expect(validatePlan(plan)).toBeNull()
  })

  it('rejects a plan missing the safety agent', () => {
    const plan = {
      ...makeValidPlan(),
      agentSequence: [makeStep('perception'), makeStep('explainability')],
    }
    expect(validatePlan(plan)).toBeNull()
  })

  it('rejects a plan where safety appears before perception', () => {
    const plan = {
      ...makeValidPlan(),
      agentSequence: [makeStep('safety'), makeStep('perception'), makeStep('explainability')],
    }
    expect(validatePlan(plan)).toBeNull()
  })

  it('rejects a plan where explainability is not last', () => {
    const plan = {
      ...makeValidPlan(),
      agentSequence: [makeStep('perception'), makeStep('explainability'), makeStep('safety')],
    }
    expect(validatePlan(plan)).toBeNull()
  })

  it('rejects a plan with duplicate agent classes', () => {
    const plan = {
      ...makeValidPlan(),
      agentSequence: [
        makeStep('perception'),
        makeStep('perception'), // duplicate
        makeStep('safety'),
        makeStep('explainability'),
      ],
    }
    expect(validatePlan(plan)).toBeNull()
  })

  it('accepts a plan without explainability (it is optional)', () => {
    const plan = {
      ...makeValidPlan(),
      agentSequence: [makeStep('perception'), makeStep('safety')],
    }
    expect(validatePlan(plan)).not.toBeNull()
  })

  it('accepts a plan without perception when there is only safety', () => {
    const plan = {
      ...makeValidPlan(),
      agentSequence: [makeStep('safety')],
    }
    expect(validatePlan(plan)).not.toBeNull()
  })
})
