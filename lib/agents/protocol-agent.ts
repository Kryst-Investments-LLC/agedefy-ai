import { checkStackAdherence } from './adherence-checker'
import type { AdherenceReport } from './adherence-checker'
import { recordClaim } from './claims'
import { queryHistoricalCorrelations } from './historical-correlation'
import type {
  AgentExecutionContext,
  AgentMessage,
  AgentStep,
  AgentStepResult,
  BioAgentInterface,
  HistoricalCorrelation,
  SafetyFlag,
} from './types'

interface BiomarkerTrend {
  name: string
  latestValue: number
  unit: string
  trend: 'UP' | 'DOWN' | 'STABLE'
}

interface PhysiologicalSnapshot {
  biomarkerSummary: BiomarkerTrend[]
  activeProtocols: { id: string; name: string; status: string }[]
  supplementStack: string[]
}

interface ProtocolRecommendations {
  additions: { compound: string; rationale: string; historicalEvidence?: string }[]
  adjustments: { protocol: string; recommendation: string }[]
  removals: { compound: string; reason: string }[]
  plateausDetected: { protocol: string; staleBiomarkers: string[] }[]
  backtestResults: HistoricalCorrelation[]
  adherenceAlerts: { compound: string; status: string; recommendation: string }[]
  adherenceReport?: AdherenceReport
}

export class ProtocolAgent implements BioAgentInterface {
  class = 'protocol' as const
  name = 'Protocol Agent'
  description = 'Analyzes active protocols and builds adjustment recommendations'

  async execute(step: AgentStep, context: AgentExecutionContext): Promise<AgentStepResult> {
    const start = Date.now()
    const messages: AgentMessage[] = []
    const safetyFlags: SafetyFlag[] = []

    context.emitTrace({
      kind: 'step_progress',
      agentClass: 'protocol',
      icon: '📋',
      message: 'Analyzing active protocols and biomarker trends for plateau detection...',
    })

    const snapshotEntry = context.scratchpad.read('perception.snapshot')
    const snapshot = snapshotEntry?.value as PhysiologicalSnapshot | undefined

    const discoveryEntry = context.scratchpad.read('discovery.results')
    const discoveryResults = discoveryEntry?.value as {
      candidates?: { commonName?: string; iupacName?: string; mechanism?: string; targetPathways?: string[] }[]
    } | undefined

    const recommendations: ProtocolRecommendations = {
      additions: [],
      adjustments: [],
      removals: [],
      plateausDetected: [],
      backtestResults: [],
      adherenceAlerts: [],
    }

    // ─── Adherence Check ───────────────────────────────────
    // Before suggesting new compounds, check if the user is actually
    // taking their current stack. If adherence is poor, prioritize
    // "take what you have" over "add something new".
    let adherenceReport: AdherenceReport | undefined
    const currentStack = snapshot?.supplementStack ?? []

    if (currentStack.length > 0) {
      context.emitTrace({
        kind: 'step_progress',
        agentClass: 'protocol',
        icon: '💊',
        message: `Checking adherence for ${currentStack.length} supplements in your current stack...`,
      })

      adherenceReport = await checkStackAdherence(context.userId, currentStack)
      recommendations.adherenceReport = adherenceReport

      if (adherenceReport.lapsedCompounds.length > 0) {
        context.emitTrace({
          kind: 'step_progress',
          agentClass: 'protocol',
          icon: '⚠️',
          message: `Adherence gap: ${adherenceReport.lapsedCompounds.join(', ')} appear to have lapsed — recommending adherence support first.`,
        })

        for (const entry of adherenceReport.entries) {
          if (entry.adherenceStatus === 'lapsed' || entry.adherenceStatus === 'discontinued') {
            recommendations.adherenceAlerts.push({
              compound: entry.compound,
              status: entry.adherenceStatus,
              recommendation:
                entry.adherenceStatus === 'discontinued'
                  ? `${entry.compound} was discontinued. If this was intentional, no action needed. Otherwise, consider restarting.`
                  : `It looks like you may have missed recent doses of ${entry.compound}. Before adding new supplements, consider refilling your current stack.`,
            })
          }
        }
      }

      context.scratchpad.write('protocol.adherence', adherenceReport, 'protocol')
    }

    // Determine whether to suppress new compound additions due to poor adherence
    const suppressNewAdditions =
      adherenceReport != null && adherenceReport.overallAdherenceRate < 0.5

    if (snapshot) {
      const stableBiomarkers = snapshot.biomarkerSummary.filter((b) => b.trend === 'STABLE')

      for (const protocol of snapshot.activeProtocols) {
        if (protocol.status === 'active' && stableBiomarkers.length > 0) {
          const staleBiomarkerNames = stableBiomarkers.map((b) => b.name)
          recommendations.plateausDetected.push({
            protocol: protocol.name,
            staleBiomarkers: staleBiomarkerNames,
          })
          recommendations.adjustments.push({
            protocol: protocol.name,
            recommendation: `Biomarkers ${staleBiomarkerNames.join(', ')} remain stable — consider protocol review or dosage adjustment`,
          })
        }
      }
    }

    // Collect candidate compound names for backtesting
    const candidateCompounds: string[] = []

    if (discoveryResults?.candidates) {
      const currentSupplements = new Set(
        (snapshot?.supplementStack ?? []).map((s) => s.toLowerCase()),
      )

      if (suppressNewAdditions) {
        // Adherence is too low — don't pile on new compounds
        context.emitTrace({
          kind: 'step_progress',
          agentClass: 'protocol',
          icon: '🛑',
          message: `Adherence rate is ${Math.round((adherenceReport?.overallAdherenceRate ?? 0) * 100)}% — holding new compound suggestions until current stack adherence improves.`,
        })
        recommendations.adjustments.push({
          protocol: 'Current Stack',
          recommendation: `Your adherence to the current supplement stack is low (${Math.round((adherenceReport?.overallAdherenceRate ?? 0) * 100)}%). Focus on consistently taking ${adherenceReport?.lapsedCompounds.join(', ')} before adding new compounds.`,
        })
      } else {
        for (const candidate of discoveryResults.candidates) {
          const name = candidate.commonName ?? candidate.iupacName
          if (name && !currentSupplements.has(name.toLowerCase())) {
            candidateCompounds.push(name)
            recommendations.additions.push({
              compound: name,
              rationale: candidate.mechanism ?? 'Identified by discovery engine',
            })
          }
        }
      }
    }

    // Agentic backtesting: query historical correlations for candidate compounds
    if (candidateCompounds.length > 0) {
      context.emitTrace({
        kind: 'step_progress',
        agentClass: 'protocol',
        icon: '🧠',
        message: `Backtesting ${candidateCompounds.length} compounds against your historical biomarker data...`,
      })
      const correlations = await queryHistoricalCorrelations(context.userId, candidateCompounds)
      recommendations.backtestResults = correlations

      // Enrich addition recommendations with historical evidence
      for (const addition of recommendations.additions) {
        const relevant = correlations.filter(
          (c) => c.compound.toLowerCase() === addition.compound.toLowerCase(),
        )
        if (relevant.length > 0) {
          const best = relevant.reduce((a, b) =>
            Math.abs(b.changePercent) > Math.abs(a.changePercent) ? b : a,
          )
          const directionLabel = best.direction === 'improved' ? 'improvement' : best.direction === 'worsened' ? 'decline' : 'no change'
          addition.historicalEvidence =
            `Previous ${best.trialPeriodDays}-day trial showed ${Math.abs(best.changePercent)}% ${directionLabel} in ${best.biomarker}`
        }
      }

      if (correlations.length > 0) {
        const best = correlations.reduce((a, b) => Math.abs(b.changePercent) > Math.abs(a.changePercent) ? b : a)
        context.emitTrace({
          kind: 'step_progress',
          agentClass: 'protocol',
          icon: '📈',
          message: `Found ${correlations.length} historical trial(s). Best match: ${Math.abs(best.changePercent)}% ${best.direction === 'improved' ? 'improvement' : 'change'} in ${best.biomarker} over ${best.trialPeriodDays} days.`,
          detail: `Compound: ${best.compound}, Protocol: ${best.protocolName}`,
        })
      }

      // Write backtesting data to scratchpad for explainability
      context.scratchpad.write('protocol.backtesting', correlations, 'protocol')

      // Provenance: each addition that is backed by a historical
      // correlation gets an AgentClaim citing that correlation. Additions
      // without historical evidence still get a claim, but cite the
      // discovery run id so they are not unprovenanced.
      for (const addition of recommendations.additions) {
        const backing = correlations.find(
          (c) => c.compound.toLowerCase() === addition.compound.toLowerCase(),
        )
        if (backing) {
          await recordClaim({
            tenantId: context.tenantId,
            sessionId: context.sessionId,
            agentClass: 'protocol',
            claimText: `Add ${addition.compound}: prior ${backing.trialPeriodDays}-day trial showed ${Math.abs(backing.changePercent)}% ${backing.direction} in ${backing.biomarker}.`,
            evidenceKind: 'COHORT_STATISTIC',
            evidenceRef: `historical-correlation:${context.userId}:${backing.compound}:${backing.biomarker}`,
            confidence: Math.min(1, Math.abs(backing.changePercent) / 100),
          }).catch(() => {})
        } else {
          await recordClaim({
            tenantId: context.tenantId,
            sessionId: context.sessionId,
            agentClass: 'protocol',
            claimText: `Add ${addition.compound}: ${addition.rationale}`,
            evidenceKind: 'COHORT_STATISTIC',
            evidenceRef: `discovery-run:${context.sessionId}`,
            confidence: 0.5,
          }).catch(() => {})
        }
      }
    }

    context.scratchpad.write('protocol.recommendations', recommendations, 'protocol')

    messages.push({
      from: 'protocol',
      to: 'supervisor',
      type: 'result',
      payload: {
        additions: recommendations.additions.length,
        adjustments: recommendations.adjustments.length,
        removals: recommendations.removals.length,
        plateaus: recommendations.plateausDetected.length,
        backtestMatches: recommendations.backtestResults.length,
        adherenceAlerts: recommendations.adherenceAlerts.length,
        adherenceRate: adherenceReport?.overallAdherenceRate ?? null,
        suppressedNewAdditions: suppressNewAdditions,
      },
      timestamp: new Date().toISOString(),
    })

    context.logger.info('Protocol agent completed', {
      sessionId: context.sessionId,
      additions: recommendations.additions.length,
      adjustments: recommendations.adjustments.length,
      plateaus: recommendations.plateausDetected.length,
      backtestMatches: recommendations.backtestResults.length,
      adherenceAlerts: recommendations.adherenceAlerts.length,
      adherenceRate: adherenceReport?.overallAdherenceRate,
    })

    return {
      outputKeys: ['protocol.recommendations', 'protocol.backtesting', 'protocol.adherence'],
      messages,
      safetyFlags,
      durationMs: Date.now() - start,
    }
  }
}
