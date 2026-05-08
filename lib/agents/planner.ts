import type { UserClinicalContext } from '@/lib/ai/clinical-context'

import type { AgentPlan, AgentStep, AgentStepStatus } from './types'

const GOAL_PATTERNS: Record<string, RegExp> = {
  discovery: /discover|research|find\s+compound|novel|candidate|molecule/i,
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

  if (GOAL_PATTERNS.discovery.test(goal)) {
    steps.push({
      index: index++,
      agentClass: 'discovery',
      description: 'Discover candidate compounds based on biomarker profile and goal',
      toolCalls: ['aeonforgeDiscover'],
      expectedOutputKeys: ['discovery.results'],
      verificationCriteria: 'At least one candidate must be returned with evidence grade',
      status: 'pending',
    })
  }

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
