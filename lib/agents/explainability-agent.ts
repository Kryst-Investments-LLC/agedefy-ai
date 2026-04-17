import type {
  AgentExecutionContext,
  AgentMessage,
  AgentStep,
  AgentStepResult,
  BioAgentInterface,
  HistoricalCorrelation,
  SafetyFlag,
  ScratchpadEntry,
} from './types'

interface BiomarkerTrend {
  name: string
  latestValue: number
  unit: string
  trend: 'UP' | 'DOWN' | 'STABLE'
  isAnomaly: boolean
}

interface PhysiologicalSnapshot {
  biomarkerSummary: BiomarkerTrend[]
  activeMedications: { name: string; dosage: string | null }[]
  activeProtocols: { id: string; name: string; status: string }[]
  supplementStack: string[]
  anomalies: BiomarkerTrend[]
}

function buildTrendSummary(snapshot: PhysiologicalSnapshot): string {
  if (snapshot.biomarkerSummary.length === 0) return 'No biomarker data available.'

  const lines = snapshot.biomarkerSummary.map((b) => {
    const arrow = b.trend === 'UP' ? '↑' : b.trend === 'DOWN' ? '↓' : '→'
    const anomalyTag = b.isAnomaly ? ' [ANOMALY]' : ''
    return `  ${b.name}: ${b.latestValue} ${b.unit} ${arrow}${anomalyTag}`
  })
  return `Biomarker trends:\n${lines.join('\n')}`
}

function buildProtocolSummary(entries: Record<string, ScratchpadEntry>): string {
  const recEntry = entries['protocol.recommendations']
  if (!recEntry?.value) return ''

  const recs = recEntry.value as {
    additions?: { compound: string; rationale: string }[]
    adjustments?: { protocol: string; recommendation: string }[]
    removals?: { compound: string; reason: string }[]
  }

  const parts: string[] = []
  if (recs.additions?.length) {
    parts.push('Suggested additions: ' + recs.additions.map((a) => a.compound).join(', '))
  }
  if (recs.adjustments?.length) {
    parts.push('Protocol adjustments: ' + recs.adjustments.map((a) => `${a.protocol}: ${a.recommendation}`).join('; '))
  }
  if (recs.removals?.length) {
    parts.push('Suggested removals: ' + recs.removals.map((r) => r.compound).join(', '))
  }
  return parts.length > 0 ? `Protocol recommendations:\n  ${parts.join('\n  ')}` : ''
}

function buildDiscoverySummary(entries: Record<string, ScratchpadEntry>): string {
  const discEntry = entries['discovery.results']
  if (!discEntry?.value) return ''

  const results = discEntry.value as {
    candidates?: { commonName?: string; iupacName?: string; mechanism?: string }[]
    evidenceGrade?: string
  }

  if (!results.candidates?.length) return ''

  const lines = results.candidates.map((c) => {
    const name = c.commonName ?? c.iupacName ?? 'Unknown'
    return `  ${name}${c.mechanism ? ` — ${c.mechanism}` : ''}`
  })
  return `Discovery findings:\n${lines.join('\n')}${results.evidenceGrade ? `\n  Evidence grade: ${results.evidenceGrade}` : ''}`
}

function buildSafetyWarnings(flags: SafetyFlag[]): string {
  if (flags.length === 0) return 'No safety concerns identified.'

  const lines = flags.map((f) => {
    const prefix = f.severity === 'critical' ? '🚨' : f.severity === 'high' ? '⚠️' : 'ℹ️'
    const review = f.requiresClinicianReview ? ' (clinician review required)' : ''
    return `  ${prefix} ${f.description}${review}`
  })
  return `Safety warnings:\n${lines.join('\n')}`
}

function buildBacktestSummary(entries: Record<string, ScratchpadEntry>): string {
  const backtestEntry = entries['protocol.backtesting']
  if (!backtestEntry?.value) return ''

  const correlations = backtestEntry.value as HistoricalCorrelation[]
  if (correlations.length === 0) return ''

  const lines = correlations.map((c) => {
    const direction = c.direction === 'improved' ? '📈' : c.direction === 'worsened' ? '📉' : '➡️'
    return `  ${direction} ${c.compound}: ${Math.abs(c.changePercent)}% ${c.direction === 'improved' ? 'improvement' : c.direction === 'worsened' ? 'decline' : 'no change'} in ${c.biomarker} over ${c.trialPeriodDays} days (protocol: ${c.protocolName})`
  })
  return `Historical evidence from your data:\n${lines.join('\n')}`
}

function buildAdherenceSummary(entries: Record<string, ScratchpadEntry>): string {
  const adherenceEntry = entries['protocol.adherence']
  if (!adherenceEntry?.value) return ''

  const report = adherenceEntry.value as {
    overallAdherenceRate: number
    lapsedCompounds: string[]
    entries: { compound: string; adherenceStatus: string; reason: string }[]
  }

  if (report.lapsedCompounds.length === 0) return ''

  const pct = Math.round(report.overallAdherenceRate * 100)
  const lines = report.entries
    .filter((e) => e.adherenceStatus === 'lapsed' || e.adherenceStatus === 'discontinued')
    .map((e) => `  💊 ${e.reason}`)

  return `Stack adherence (${pct}%):\n${lines.join('\n')}\n  ⚡ ACTION: Refill your current stack before adding new compounds.`
}

function buildCommerceActions(entries: Record<string, ScratchpadEntry>): string {
  const adherenceEntry = entries['protocol.adherence']
  const recEntry = entries['protocol.recommendations']

  const actions: string[] = []

  // Refill suggestions for lapsed compounds
  if (adherenceEntry?.value) {
    const report = adherenceEntry.value as {
      lapsedCompounds: string[]
      entries: { compound: string; adherenceStatus: string; lastRefillDaysAgo: number | null }[]
    }
    const lapsedItems = report.entries.filter((e) => e.adherenceStatus === 'lapsed')
    if (lapsedItems.length > 0) {
      actions.push(`🔄 REFILL RECOMMENDED: ${lapsedItems.map((e) => e.compound).join(', ')}`)
    }
  }

  // New additions from protocol recommendations
  if (recEntry?.value) {
    const recs = recEntry.value as { additions?: { compound: string }[] }
    if (recs.additions?.length) {
      actions.push(`🛒 NEW COMPOUNDS: ${recs.additions.map((a) => a.compound).join(', ')}`)
    }
  }

  if (actions.length === 0) return ''
  return `Recommended actions:\n  ${actions.join('\n  ')}`
}

export class ExplainabilityAgent implements BioAgentInterface {
  class = 'explainability' as const
  name = 'Explainability Agent'
  description = 'Generates plain-language summary of all findings and safety warnings'

  async execute(step: AgentStep, context: AgentExecutionContext): Promise<AgentStepResult> {
    const start = Date.now()
    const messages: AgentMessage[] = []
    const safetyFlags: SafetyFlag[] = []

    context.emitTrace({
      kind: 'step_progress',
      agentClass: 'explainability',
      icon: '💡',
      message: 'Building plain-language summary of all findings...',
    })

    const allEntries = context.scratchpad.readAll()

    const flagsEntry = context.scratchpad.read('safety.flags')
    const existingFlags = (flagsEntry?.value as SafetyFlag[] | undefined) ?? []

    const sections: string[] = []

    const snapshotEntry = context.scratchpad.read('perception.snapshot')
    if (snapshotEntry?.value) {
      sections.push(buildTrendSummary(snapshotEntry.value as PhysiologicalSnapshot))
    }

    const discoverySummary = buildDiscoverySummary(allEntries)
    if (discoverySummary) sections.push(discoverySummary)

    const protocolSummary = buildProtocolSummary(allEntries)
    if (protocolSummary) sections.push(protocolSummary)

    const backtestSummary = buildBacktestSummary(allEntries)
    if (backtestSummary) sections.push(backtestSummary)

    const adherenceSummary = buildAdherenceSummary(allEntries)
    if (adherenceSummary) sections.push(adherenceSummary)

    sections.push(buildSafetyWarnings(existingFlags))

    const commerceActions = buildCommerceActions(allEntries)
    if (commerceActions) sections.push(commerceActions)

    const summary = sections.filter(Boolean).join('\n\n')

    context.scratchpad.write('explainability.summary', summary, 'explainability')

    messages.push({
      from: 'explainability',
      to: 'supervisor',
      type: 'result',
      payload: { summaryLength: summary.length },
      timestamp: new Date().toISOString(),
    })

    context.logger.info('Explainability agent completed', {
      sessionId: context.sessionId,
      summaryLength: summary.length,
    })

    return {
      outputKeys: ['explainability.summary'],
      messages,
      safetyFlags,
      durationMs: Date.now() - start,
    }
  }
}
