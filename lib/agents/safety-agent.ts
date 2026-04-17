import { checkUserInteractions } from '@/lib/safety/interaction-checker'
import { createReviewItem } from '@/lib/audit'
import { logAudit } from '@/lib/audit'

import { evaluateGovernance } from './governance'
import type { GovernanceEvaluation } from './governance'
import type {
  AgentExecutionContext,
  AgentMessage,
  AgentStep,
  AgentStepResult,
  BioAgentInterface,
  SafetyFlag,
  ScratchpadEntry,
} from './types'

function extractCompoundNames(entries: Record<string, ScratchpadEntry>): string[] {
  const compounds: string[] = []

  const discoveryEntry = entries['discovery.results']
  if (discoveryEntry?.value && typeof discoveryEntry.value === 'object') {
    const results = discoveryEntry.value as { candidates?: { commonName?: string; iupacName?: string }[] }
    if (Array.isArray(results.candidates)) {
      for (const c of results.candidates) {
        if (c.commonName) compounds.push(c.commonName)
        else if (c.iupacName) compounds.push(c.iupacName)
      }
    }
  }

  const protocolEntry = entries['protocol.recommendations']
  if (protocolEntry?.value && typeof protocolEntry.value === 'object') {
    const recs = protocolEntry.value as { additions?: { compound: string }[] }
    if (Array.isArray(recs.additions)) {
      for (const r of recs.additions) {
        if (r.compound) compounds.push(r.compound)
      }
    }
  }

  return compounds
}

function mapInteractionSeverity(severity: string): SafetyFlag['severity'] {
  switch (severity) {
    case 'DANGEROUS':
      return 'critical'
    case 'CAUTION':
      return 'high'
    default:
      return 'medium'
  }
}

export class SafetyAgent implements BioAgentInterface {
  class = 'safety' as const
  name = 'Safety Agent'
  description = 'Checks all recommendations for contraindications and drug/supplement interactions'

  async execute(step: AgentStep, context: AgentExecutionContext): Promise<AgentStepResult> {
    const start = Date.now()
    const messages: AgentMessage[] = []
    const safetyFlags: SafetyFlag[] = []

    const allEntries = context.scratchpad.readAll()

    const recommendedCompounds = extractCompoundNames(allEntries)
    const medCount = context.clinicalContext.medications.length
    context.emitTrace({
      kind: 'step_progress',
      agentClass: 'safety',
      icon: '🛡️',
      message: `Cross-referencing ${recommendedCompounds.length} compounds against ${medCount} active medication(s)...`,
    })

    const interactionResult = await checkUserInteractions(context.userId, context.tenantId)

    for (const flag of interactionResult.flags) {
      const sf: SafetyFlag = {
        id: crypto.randomUUID(),
        severity: mapInteractionSeverity(flag.severity),
        description: `Interaction detected: ${flag.compoundA} × ${flag.compoundB} — ${flag.description ?? flag.severity}`,
        source: 'safety',
        requiresClinicianReview: flag.severity === 'DANGEROUS',
        createdAt: new Date().toISOString(),
      }
      safetyFlags.push(sf)
    }

    const recommendedCompounds = extractCompoundNames(allEntries)
    const userMedications = context.clinicalContext.medications.map((m) => m.name.toLowerCase())

    for (const compound of recommendedCompounds) {
      for (const med of userMedications) {
        if (compound.toLowerCase() === med) {
          const sf: SafetyFlag = {
            id: crypto.randomUUID(),
            severity: 'high',
            description: `Recommended compound "${compound}" is already in the user's active medications`,
            source: 'safety',
            requiresClinicianReview: true,
            createdAt: new Date().toISOString(),
          }
          safetyFlags.push(sf)
        }
      }
    }

    context.scratchpad.write('safety.flags', safetyFlags, 'safety')

    // ─── Governance Evaluation ─────────────────────────────
    // Run traffic-light tiering on all recommended compounds
    const adherenceEntry = context.scratchpad.read('protocol.adherence')
    const adherenceRate = adherenceEntry?.value
      ? (adherenceEntry.value as { overallAdherenceRate?: number }).overallAdherenceRate ?? null
      : null

    const hasLabReport = context.scratchpad.read('perception.lab_upload') !== undefined

    context.emitTrace({
      kind: 'step_progress',
      agentClass: 'safety',
      icon: '🚦',
      message: `Running governance tiering on ${recommendedCompounds.length} compound(s)...`,
    })

    let governanceResult: GovernanceEvaluation | undefined
    if (recommendedCompounds.length > 0) {
      governanceResult = await evaluateGovernance(
        recommendedCompounds,
        adherenceRate,
        context.sessionId,
        context.userId,
        context.tenantId,
        hasLabReport,
      )

      context.scratchpad.write('safety.governance', governanceResult, 'safety')

      // Emit per-compound governance decisions
      for (const result of governanceResult.results) {
        const icon = result.decision === 'AUTO_APPROVED' ? '🟢'
          : result.decision === 'AWAITING_REVIEW' ? '🟡'
          : '🔴'

        context.emitTrace({
          kind: 'governance_decision',
          agentClass: 'safety',
          icon,
          message: `${icon} ${result.compoundName}: ${result.decision.replace('_', ' ')}`,
          detail: result.reason,
        })
      }

      // Emit summary
      context.emitTrace({
        kind: 'step_progress',
        agentClass: 'safety',
        icon: '🚦',
        message: `Governance: ${governanceResult.autoApprovedCount} auto-approved, ${governanceResult.reviewRequiredCount} pending review, ${governanceResult.escalatedCount} escalated.`,
      })

      // Create review items for ESCALATED compounds (RED tier)
      for (const result of governanceResult.results) {
        if (result.decision === 'ESCALATED') {
          const sf: SafetyFlag = {
            id: crypto.randomUUID(),
            severity: 'critical',
            description: `Governance escalation: ${result.compoundName} (${result.riskCategory}) requires clinician signature before user notification.`,
            source: 'safety',
            requiresClinicianReview: true,
            createdAt: new Date().toISOString(),
          }
          safetyFlags.push(sf)
        }
      }
    }

    if (safetyFlags.length === 0) {
      context.emitTrace({
        kind: 'step_progress',
        agentClass: 'safety',
        icon: '✅',
        message: 'No contraindications or dangerous interactions found.',
      })
    } else {
      context.emitTrace({
        kind: 'step_progress',
        agentClass: 'safety',
        icon: '⚠️',
        message: `Flagged ${safetyFlags.length} safety concern(s) — ${safetyFlags.filter((f) => f.requiresClinicianReview).length} require clinician review.`,
        detail: safetyFlags.slice(0, 3).map((f) => f.description).join('; '),
      })
    }

    const dangerousFlags = safetyFlags.filter(
      (f) => f.severity === 'critical' || f.severity === 'high',
    )

    if (dangerousFlags.length > 0) {
      context.emitTrace({
        kind: 'safety_flag',
        agentClass: 'safety',
        icon: '👨\u200d⚕️',
        message: `Escalating ${dangerousFlags.length} flag(s) to Clinician Review.`,
      })
    }

    const reviewItemIds: string[] = []
    for (const flag of dangerousFlags) {
      const reviewItem = await createReviewItem({
        title: `Agent Safety Flag: ${flag.description}`,
        category: 'agent-safety',
        severity: flag.severity === 'critical' ? 'CRITICAL' : 'HIGH',
        details: JSON.stringify({ ...flag, agentSessionId: context.sessionId }),
        relatedEntityType: 'AgentSession',
        relatedEntityId: context.sessionId,
      })
      if (reviewItem?.id) reviewItemIds.push(reviewItem.id)
    }

    if (dangerousFlags.length > 0) {
      messages.push({
        from: 'safety',
        to: 'supervisor',
        type: 'safety_flag',
        payload: { flagCount: dangerousFlags.length, flags: dangerousFlags, reviewItemIds },
        timestamp: new Date().toISOString(),
      })
    }

    await logAudit({
      actorUserId: context.userId,
      tenantId: context.tenantId,
      action: 'agent.safety_check',
      entityType: 'AgentSession',
      entityId: context.sessionId,
      details: {
        totalFlags: safetyFlags.length,
        dangerousFlags: dangerousFlags.length,
        interactionFlags: interactionResult.flags.length,
        governanceAutoApproved: governanceResult?.autoApprovedCount ?? 0,
        governanceReviewRequired: governanceResult?.reviewRequiredCount ?? 0,
        governanceEscalated: governanceResult?.escalatedCount ?? 0,
      },
    })

    context.logger.info('Safety agent completed', {
      sessionId: context.sessionId,
      totalFlags: safetyFlags.length,
      dangerousFlags: dangerousFlags.length,
    })

    return {
      outputKeys: ['safety.flags'],
      messages,
      safetyFlags,
      durationMs: Date.now() - start,
    }
  }
}
