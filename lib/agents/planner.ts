import type { UserClinicalContext } from '@/lib/ai/clinical-context'

import type { InvestigationPlan } from './clinical-planning-agent'
import type { AgentPlan, AgentStep, AgentStepStatus } from './types'

// NOTE: There is deliberately no 'discovery' pattern. The discovery agent
// (biomarker profile -> compound suggestion) is a FORBIDDEN PATH for
// consumer-facing sessions; the planner must never schedule a discovery step.
const GOAL_PATTERNS: Record<string, RegExp> = {
  protocol: /protocol|stack|adjust|optimize|regimen|dosage|supplement/i,
}

export function createPlan(goal: string, _clinicalContext: UserClinicalContext): AgentPlan {
  const steps: AgentStep[] = []
  let index = 0

  steps.push({
    index: index++,
    agentClass: 'perception',
    description: 'Gather and analyze biomarker data, medications, and supplement stack',
    toolCalls: ['buildClinicalSnapshot'],
    expectedOutputKeys: ['perception.snapshot'],
    verificationCriteria: 'Snapshot must include biomarker summary and active medications',
    status: 'pending',
  })

  if (GOAL_PATTERNS.protocol.test(goal)) {
    steps.push({
      index: index++,
      agentClass: 'protocol',
      description: 'Analyze protocols and build adjustment recommendations',
      toolCalls: ['analyzeProtocols'],
      expectedOutputKeys: ['protocol.recommendations'],
      verificationCriteria: 'Recommendations must reference active protocols and biomarker trends',
      status: 'pending',
    })
  }

  steps.push({
    index: index++,
    agentClass: 'safety',
    description: 'Check all recommendations for contraindications and interactions',
    toolCalls: ['checkInteractions', 'scanContraindications'],
    expectedOutputKeys: ['safety.flags'],
    verificationCriteria: 'All compound recommendations must be checked against user medications',
    status: 'pending',
  })

  steps.push({
    index: index++,
    agentClass: 'explainability',
    description: 'Generate plain-language summary of all findings and safety warnings',
    toolCalls: ['buildSummary'],
    expectedOutputKeys: ['explainability.summary'],
    verificationCriteria: 'Summary must include safety warnings if any flags were raised',
    status: 'pending',
  })

  return {
    goal,
    steps,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Build an AgentPlan from an InvestigationPlan produced by the ClinicalPlanningAgent.
 * The sequence and step descriptions come from the investigation plan;
 * tool calls and verification criteria are derived from the agent class.
 */
export function createPlanFromInvestigation(
  goal: string,
  _clinicalContext: UserClinicalContext,
  investigationPlan: InvestigationPlan,
): AgentPlan {
  const STEP_META: Record<string, { toolCalls: string[]; expectedOutputKeys: string[]; verificationCriteria?: string }> = {
    perception: {
      toolCalls: ['buildClinicalSnapshot'],
      expectedOutputKeys: ['perception.snapshot'],
      verificationCriteria: 'Snapshot must include biomarker summary and active medications',
    },
    protocol: {
      toolCalls: ['analyzeProtocols'],
      expectedOutputKeys: ['protocol.recommendations'],
      verificationCriteria: 'Recommendations must reference active protocols and biomarker trends',
    },
    safety: {
      toolCalls: ['checkInteractions', 'scanContraindications'],
      expectedOutputKeys: ['safety.flags'],
      verificationCriteria: 'All compound recommendations must be checked against user medications',
    },
    explainability: {
      toolCalls: ['buildSummary'],
      expectedOutputKeys: ['explainability.summary'],
      verificationCriteria: 'Summary must include safety warnings if any flags were raised',
    },
  }

  const steps: AgentStep[] = investigationPlan.agentSequence.map((seq, idx) => ({
    index: idx,
    agentClass: seq.agentClass,
    description: seq.reason,
    toolCalls: STEP_META[seq.agentClass]?.toolCalls ?? [],
    expectedOutputKeys: STEP_META[seq.agentClass]?.expectedOutputKeys ?? [],
    verificationCriteria: STEP_META[seq.agentClass]?.verificationCriteria,
    status: 'pending',
  }))

  return { goal, steps, createdAt: new Date().toISOString() }
}

export function revisePlan(plan: AgentPlan, failedStepIndex: number, error: string): AgentPlan {
  const updatedSteps = plan.steps.map((step) => {
    if (step.index === failedStepIndex) {
      return { ...step, status: 'failed' as AgentStepStatus, error }
    }
    return step
  })

  const failedStep = updatedSteps[failedStepIndex]
  if (failedStep?.agentClass === 'safety') {
    for (let i = failedStepIndex + 1; i < updatedSteps.length; i++) {
      updatedSteps[i] = { ...updatedSteps[i], status: 'skipped' as AgentStepStatus }
    }
  }

  return {
    ...plan,
    steps: updatedSteps,
    revisedAt: new Date().toISOString(),
  }
}
