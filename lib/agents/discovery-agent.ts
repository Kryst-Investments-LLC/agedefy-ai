import { aeonforgeService } from '@/lib/services/aeonforge'
import type { AeonForgePromptRequest } from '@/lib/services/aeonforge'

import { recordClaim } from './claims'
import type {
  AgentExecutionContext,
  AgentMessage,
  AgentStep,
  AgentStepResult,
  BioAgentInterface,
  SafetyFlag,
} from './types'

interface PhysiologicalSnapshot {
  biomarkerSummary: { name: string; latestValue: number; unit: string; trend: string }[]
  anomalies: { name: string; latestValue: number; unit: string }[]
}

export class DiscoveryAgent implements BioAgentInterface {
  class = 'discovery' as const
  name = 'Discovery Agent'
  description = 'Discovers candidate compounds using the ÆonForge engine based on user profile'

  async execute(step: AgentStep, context: AgentExecutionContext): Promise<AgentStepResult> {
    const start = Date.now()
    const messages: AgentMessage[] = []
    const safetyFlags: SafetyFlag[] = []

    context.emitTrace({
      kind: 'step_progress',
      agentClass: 'discovery',
      icon: '🧬',
      message: 'Querying ÆonForge discovery engine for candidate compounds...',
    })

    const snapshotEntry = context.scratchpad.read('perception.snapshot')
    const snapshot = snapshotEntry?.value as PhysiologicalSnapshot | undefined

    const biomarkerData: Record<string, number> = {}
    if (snapshot?.biomarkerSummary) {
      for (const b of snapshot.biomarkerSummary) {
        biomarkerData[b.name] = b.latestValue
      }
    }

    const anomalyNames = snapshot?.anomalies?.map((a) => a.name) ?? []
    const goals = context.clinicalContext.longevityGoal
      ? [context.clinicalContext.longevityGoal]
      : []

    const promptParts = [
      `Analyze the following biomarker profile and suggest candidate compounds for longevity optimization.`,
    ]
    if (anomalyNames.length > 0) {
      promptParts.push(`Anomalous biomarkers requiring attention: ${anomalyNames.join(', ')}.`)
    }
    if (context.clinicalContext.healthConditions.length > 0) {
      promptParts.push(`Health conditions: ${context.clinicalContext.healthConditions.join(', ')}.`)
    }

    const request: AeonForgePromptRequest = {
      prompt: promptParts.join(' '),
      userId: context.userId,
      userContext: {
        biomarkers: biomarkerData,
        goals,
        healthHistory: context.clinicalContext.healthConditions.join(', '),
      },
    }

    const response = await aeonforgeService.discoverCandidates(request)

    const discoveryResults = {
      candidates: response.candidates,
      evidenceGrade: response.evidenceGrade,
      candidateEvidenceGrades: response.candidateEvidenceGrades,
      confidence: response.confidence,
      warnings: response.warnings,
      disclaimers: response.disclaimers,
    }

    context.scratchpad.write('discovery.results', discoveryResults, 'discovery')

    // Provenance: every candidate the discovery agent surfaces is logged
    // as an AgentClaim citing the AeonForge run that produced it. Without
    // this row the explainability agent has nothing to cite downstream.
    for (const candidate of response.candidates) {
      const name = candidate.commonName ?? candidate.iupacName
      if (!name) continue
      const evidenceRef =
        (candidate as { id?: string; aeonForgeRunId?: string }).aeonForgeRunId ??
        (candidate as { id?: string }).id ??
        `aeonforge:${context.sessionId}`
      await recordClaim({
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        agentClass: 'discovery',
        claimText: `Candidate compound "${name}" suggested for the user's biomarker profile.`,
        evidenceKind: 'COHORT_STATISTIC',
        evidenceRef,
        confidence: response.confidence,
      }).catch((err) => {
        context.logger.warn('discovery.recordClaim_failed', {
          sessionId: context.sessionId,
          name,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }

    context.emitTrace({
      kind: 'step_progress',
      agentClass: 'discovery',
      icon: '🔬',
      message: `Found ${response.candidates.length} candidate compounds (confidence: ${Math.round(response.confidence * 100)}%).`,
      detail: response.candidates.slice(0, 3).map((c) => c.commonName ?? c.iupacName).filter(Boolean).join(', '),
    })

    messages.push({
      from: 'discovery',
      to: 'supervisor',
      type: 'result',
      payload: {
        candidateCount: response.candidates.length,
        confidence: response.confidence,
        evidenceGrade: response.evidenceGrade,
      },
      timestamp: new Date().toISOString(),
    })

    context.logger.info('Discovery agent completed', {
      sessionId: context.sessionId,
      candidateCount: response.candidates.length,
      confidence: response.confidence,
    })

    return {
      outputKeys: ['discovery.results'],
      messages,
      safetyFlags,
      durationMs: Date.now() - start,
    }
  }
}
