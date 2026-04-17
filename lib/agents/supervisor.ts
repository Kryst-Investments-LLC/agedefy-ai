import { buildUserClinicalContext } from '@/lib/ai/clinical-context'
import { logAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

import { DiscoveryAgent } from './discovery-agent'
import { ExplainabilityAgent } from './explainability-agent'
import { PerceptionAgent } from './perception-agent'
import { createPlan, revisePlan } from './planner'
import { ProtocolAgent } from './protocol-agent'
import { SafetyAgent } from './safety-agent'
import { Scratchpad } from './scratchpad'
import { createTraceEmitter } from './trace-emitter'
import type {
  AgentClass,
  AgentExecutionContext,
  AgentMessage,
  AgentResult,
  AgentSessionStatus,
  BioAgentInterface,
  SafetyFlag,
  TraceEmitter,
} from './types'

export class SupervisorAgent {
  private userId: string
  private tenantId: string
  private agents: Map<AgentClass, BioAgentInterface>

  constructor(userId: string, tenantId: string) {
    this.userId = userId
    this.tenantId = tenantId
    this.agents = new Map<AgentClass, BioAgentInterface>([
      ['perception', new PerceptionAgent()],
      ['discovery', new DiscoveryAgent()],
      ['protocol', new ProtocolAgent()],
      ['safety', new SafetyAgent()],
      ['explainability', new ExplainabilityAgent()],
    ])
  }

  async run(goal: string, labReportText?: string): Promise<AgentResult> {
    const sessionId = crypto.randomUUID()
    const startedAt = new Date().toISOString()
    const allMessages: AgentMessage[] = []
    const allSafetyFlags: SafetyFlag[] = []

    const emitTrace: TraceEmitter = createTraceEmitter(sessionId)

    emitTrace({ kind: 'session_start', icon: '🚀', message: `Starting analysis: "${goal.slice(0, 80)}${goal.length > 80 ? '…' : ''}"` })

    const clinicalContext = await buildUserClinicalContext(this.userId)
    let plan = createPlan(goal, clinicalContext)

    emitTrace({ kind: 'plan_created', icon: '📋', message: `Plan created with ${plan.steps.length} steps: ${plan.steps.map((s) => s.agentClass).join(' → ')}` })

    const scratchpad = new Scratchpad()

    // Seed lab report text if provided (multi-modal perception)
    if (labReportText) {
      scratchpad.write('perception.lab_upload', labReportText, 'perception')
      emitTrace({ kind: 'step_progress', agentClass: 'perception', icon: '📎', message: 'Lab report text attached — will be parsed during analysis.' })
    }

    const context: AgentExecutionContext = {
      sessionId,
      userId: this.userId,
      tenantId: this.tenantId,
      clinicalContext,
      scratchpad,
      logger,
      emitTrace,
    }

    // Persist session as RUNNING
    await db.agentSession.create({
      data: {
        id: sessionId,
        userId: this.userId,
        tenantId: this.tenantId,
        goal,
        status: 'RUNNING',
        plan: JSON.stringify(plan),
      },
    })

    const executionResult = await this.executeSteps(plan, context, allMessages, allSafetyFlags)
    plan = executionResult.plan

    // Governance-aware status determination
    // Check the governance evaluation written by the SafetyAgent
    const governanceEntry = scratchpad.read('safety.governance')
    const governanceResult = governanceEntry?.value as {
      overallDecision?: string
      escalatedCount?: number
      reviewRequiredCount?: number
      autoApprovedCount?: number
    } | undefined

    const hasDangerousFlags = allSafetyFlags.some(
      (f) => (f.severity === 'critical' || f.severity === 'high') && f.requiresClinicianReview,
    )

    const governanceRequiresReview =
      governanceResult?.overallDecision === 'ESCALATED' ||
      governanceResult?.overallDecision === 'AWAITING_REVIEW'

    let status: AgentSessionStatus
    const hasFailedSteps = plan.steps.some((s) => s.status === 'failed')
    const allCompleted = plan.steps.every(
      (s) => s.status === 'completed' || s.status === 'skipped',
    )

    if (hasDangerousFlags || governanceRequiresReview) {
      status = 'awaiting_review'
      if (governanceResult?.escalatedCount && governanceResult.escalatedCount > 0) {
        emitTrace({ kind: 'hitl_pause', icon: '🔴', message: `Session paused — ${governanceResult.escalatedCount} RED-tier compound(s) require clinician signature before proceeding.` })
      } else if (governanceRequiresReview) {
        emitTrace({ kind: 'hitl_pause', icon: '🟡', message: `Session paused — ${governanceResult?.reviewRequiredCount ?? 0} compound(s) require passive clinician review.` })
      } else {
        emitTrace({ kind: 'hitl_pause', icon: '👨‍⚕️', message: 'Session paused — flagged recommendations require clinician review before proceeding.' })
      }
    } else if (allCompleted) {
      status = 'completed'
      if (governanceResult?.autoApprovedCount && governanceResult.autoApprovedCount > 0) {
        emitTrace({ kind: 'step_progress', icon: '🟢', message: `Governance: ${governanceResult.autoApprovedCount} compound(s) auto-approved (GREEN tier, high adherence, zero contraindications).` })
      }
    } else if (hasFailedSteps) {
      status = 'failed'
    } else {
      status = 'completed'
    }

    const summaryEntry = scratchpad.read('explainability.summary')
    const summary = typeof summaryEntry?.value === 'string' ? summaryEntry.value : undefined

    const completedAt = status === 'awaiting_review' ? undefined : new Date().toISOString()
    const totalDurationMs = (completedAt ? new Date(completedAt).getTime() : Date.now()) - new Date(startedAt).getTime()

    if (status === 'completed') {
      emitTrace({ kind: 'session_complete', icon: '✅', message: `Analysis complete in ${(totalDurationMs / 1000).toFixed(1)}s.` })
    } else if (status === 'failed') {
      emitTrace({ kind: 'session_complete', icon: '❌', message: 'Analysis finished with errors. Check the plan for details.' })
    }

    // Collect review item IDs from safety agent messages
    const reviewItemIds = this.extractReviewItemIds(allMessages)

    const agentResult: AgentResult = {
      sessionId,
      status,
      plan,
      scratchpad: scratchpad.snapshot(),
      messages: allMessages,
      summary,
      safetyFlags: allSafetyFlags,
      startedAt,
      completedAt,
      totalDurationMs,
      awaitingReviewItemIds: reviewItemIds.length > 0 ? reviewItemIds : undefined,
    }

    // Persist session state
    await db.agentSession.update({
      where: { id: sessionId },
      data: {
        status: status === 'awaiting_review' ? 'AWAITING_REVIEW' : status === 'completed' ? 'COMPLETED' : 'FAILED',
        plan: JSON.stringify(plan),
        scratchpad: JSON.stringify(scratchpad.snapshot()),
        result: JSON.stringify(agentResult),
        reviewItemIds: reviewItemIds.length > 0 ? JSON.stringify(reviewItemIds) : null,
        completedAt: completedAt ? new Date(completedAt) : null,
      },
    })

    await logAudit({
      actorUserId: this.userId,
      tenantId: this.tenantId,
      action: status === 'awaiting_review' ? 'agent.session_awaiting_review' : 'agent.session_completed',
      entityType: 'AgentSession',
      entityId: sessionId,
      details: {
        goal,
        status,
        stepCount: plan.steps.length,
        completedSteps: plan.steps.filter((s) => s.status === 'completed').length,
        failedSteps: plan.steps.filter((s) => s.status === 'failed').length,
        safetyFlagCount: allSafetyFlags.length,
        totalDurationMs,
        awaitingReview: hasDangerousFlags || governanceRequiresReview,
        governanceDecision: governanceResult?.overallDecision ?? null,
        governanceAutoApproved: governanceResult?.autoApprovedCount ?? 0,
        governanceEscalated: governanceResult?.escalatedCount ?? 0,
      },
    })

    return agentResult
  }

  async resume(sessionId: string, reviewedBy: string): Promise<AgentResult> {
    const sessionRecord = await db.agentSession.findUnique({ where: { id: sessionId } })

    if (!sessionRecord) {
      throw new Error(`Agent session ${sessionId} not found`)
    }

    if (sessionRecord.status !== 'AWAITING_REVIEW') {
      throw new Error(`Agent session ${sessionId} is not awaiting review (current: ${sessionRecord.status})`)
    }

    if (sessionRecord.userId !== this.userId) {
      throw new Error('Session does not belong to this user')
    }

    const resumedAt = new Date().toISOString()
    const clinicalContext = await buildUserClinicalContext(this.userId)

    const savedScratchpad = sessionRecord.scratchpad
      ? Scratchpad.fromSnapshot(JSON.parse(sessionRecord.scratchpad) as Record<string, import('./types').ScratchpadEntry>)
      : new Scratchpad()

    // Clear previous safety flags so re-evaluation runs clean
    savedScratchpad.delete('safety.flags')

    const savedPlan = sessionRecord.plan
      ? (JSON.parse(sessionRecord.plan) as import('./types').AgentPlan)
      : null

    if (!savedPlan) {
      throw new Error('No plan found in session record')
    }

    const context: AgentExecutionContext = {
      sessionId,
      userId: this.userId,
      tenantId: this.tenantId,
      clinicalContext,
      scratchpad: savedScratchpad,
      logger,
      emitTrace: createTraceEmitter(sessionId),
    }

    context.emitTrace({ kind: 'session_start', icon: '🔄', message: `Session resumed after clinician review by ${reviewedBy}.` })

    // Mark AWAITING_REVIEW → RUNNING
    await db.agentSession.update({
      where: { id: sessionId },
      data: { status: 'RUNNING', resumedAt: new Date(resumedAt), reviewedBy },
    })

    // Reset safety and explainability steps to pending for re-execution
    const resetPlan = {
      ...savedPlan,
      steps: savedPlan.steps.map((step) => {
        if (step.agentClass === 'safety' || step.agentClass === 'explainability') {
          return { ...step, status: 'pending' as const, error: undefined, result: undefined }
        }
        return step
      }),
      revisedAt: resumedAt,
    }

    const allMessages: AgentMessage[] = []
    const allSafetyFlags: SafetyFlag[] = []

    const executionResult = await this.executeSteps(resetPlan, context, allMessages, allSafetyFlags)
    const plan = executionResult.plan

    const allCompleted = plan.steps.every(
      (s) => s.status === 'completed' || s.status === 'skipped',
    )
    const hasFailedSteps = plan.steps.some((s) => s.status === 'failed')
    const status: AgentSessionStatus = allCompleted ? 'completed' : hasFailedSteps ? 'failed' : 'completed'

    const summaryEntry = savedScratchpad.read('explainability.summary')
    const summary = typeof summaryEntry?.value === 'string' ? summaryEntry.value : undefined

    const completedAt = new Date().toISOString()
    const originalStart = sessionRecord.createdAt.toISOString()
    const totalDurationMs = new Date(completedAt).getTime() - new Date(originalStart).getTime()

    const agentResult: AgentResult = {
      sessionId,
      status,
      plan,
      scratchpad: savedScratchpad.snapshot(),
      messages: allMessages,
      summary,
      safetyFlags: allSafetyFlags,
      startedAt: originalStart,
      completedAt,
      totalDurationMs,
      resumedAt,
      reviewedBy,
    }

    await db.agentSession.update({
      where: { id: sessionId },
      data: {
        status: status === 'completed' ? 'COMPLETED' : 'FAILED',
        plan: JSON.stringify(plan),
        scratchpad: JSON.stringify(savedScratchpad.snapshot()),
        result: JSON.stringify(agentResult),
        completedAt: new Date(completedAt),
      },
    })

    await logAudit({
      actorUserId: this.userId,
      tenantId: this.tenantId,
      action: 'agent.session_resumed',
      entityType: 'AgentSession',
      entityId: sessionId,
      details: {
        reviewedBy,
        resumedAt,
        status,
        safetyFlagCount: allSafetyFlags.length,
      },
    })

    return agentResult
  }

  private async executeSteps(
    plan: import('./types').AgentPlan,
    context: AgentExecutionContext,
    allMessages: AgentMessage[],
    allSafetyFlags: SafetyFlag[],
  ): Promise<{ plan: import('./types').AgentPlan }> {
    const AGENT_ICONS: Record<string, string> = {
      perception: '🔍',
      discovery: '🧬',
      protocol: '📋',
      safety: '🛡️',
      explainability: '💡',
    }

    let currentPlan = plan

    for (const step of currentPlan.steps) {
      if (step.status === 'skipped' || step.status === 'failed' || step.status === 'completed') continue

      const agent = this.agents.get(step.agentClass)
      if (!agent) {
        step.status = 'failed'
        step.error = `No agent registered for class: ${step.agentClass}`
        currentPlan = revisePlan(currentPlan, step.index, step.error)
        continue
      }

      step.status = 'running'

      context.emitTrace({
        kind: 'step_start',
        agentClass: step.agentClass,
        icon: AGENT_ICONS[step.agentClass] ?? '⚙️',
        message: `${agent.name} starting: ${step.description}`,
      })

      try {
        const result = await agent.execute(step, context)
        step.status = 'completed'
        step.durationMs = result.durationMs
        step.result = { outputKeys: result.outputKeys }
        allMessages.push(...result.messages)
        allSafetyFlags.push(...result.safetyFlags)

        context.emitTrace({
          kind: 'step_complete',
          agentClass: step.agentClass,
          icon: '✓',
          message: `${agent.name} completed in ${result.durationMs}ms.`,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        step.status = 'failed'
        step.error = errorMessage

        context.emitTrace({
          kind: 'step_failed',
          agentClass: step.agentClass,
          icon: '✗',
          message: `${agent.name} failed: ${errorMessage}`,
        })

        logger.error('Agent step failed', {
          sessionId: context.sessionId,
          stepIndex: step.index,
          agentClass: step.agentClass,
          error: errorMessage,
        })

        currentPlan = revisePlan(currentPlan, step.index, errorMessage)
      }
    }

    return { plan: currentPlan }
  }

  private extractReviewItemIds(messages: AgentMessage[]): string[] {
    const ids: string[] = []
    for (const msg of messages) {
      if (msg.type === 'safety_flag' && msg.payload && typeof msg.payload === 'object') {
        const payload = msg.payload as { reviewItemIds?: string[] }
        if (Array.isArray(payload.reviewItemIds)) {
          ids.push(...payload.reviewItemIds)
        }
      }
    }
    return ids
  }
}
