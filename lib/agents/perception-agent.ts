import type { ClinicalContextBiomarker } from '@/lib/ai/clinical-context'

import { parseLabReportText } from './lab-report-parser'
import type {
  AgentExecutionContext,
  AgentMessage,
  AgentStep,
  AgentStepResult,
  BioAgentInterface,
  LabReportParseResult,
  ParsedLabValue,
  SafetyFlag,
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
  uploadedLabReport?: LabReportParseResult
  wearableSources: string[]
}

function analyzeTrends(biomarkers: ClinicalContextBiomarker[]): BiomarkerTrend[] {
  const grouped = new Map<string, ClinicalContextBiomarker[]>()
  for (const b of biomarkers) {
    const existing = grouped.get(b.name) ?? []
    existing.push(b)
    grouped.set(b.name, existing)
  }

  const trends: BiomarkerTrend[] = []
  for (const [name, values] of grouped) {
    const sorted = [...values].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
    )
    const latest = sorted[0]
    let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE'

    if (sorted.length >= 2) {
      const diff = sorted[0].value - sorted[1].value
      const threshold = Math.abs(sorted[1].value) * 0.05
      if (diff > threshold) trend = 'UP'
      else if (diff < -threshold) trend = 'DOWN'
    }

    const mean = sorted.reduce((sum, v) => sum + v.value, 0) / sorted.length
    const stdDev = Math.sqrt(
      sorted.reduce((sum, v) => sum + (v.value - mean) ** 2, 0) / sorted.length,
    )
    const isAnomaly = stdDev > 0 && Math.abs(latest.value - mean) > 2 * stdDev

    trends.push({
      name,
      latestValue: latest.value,
      unit: latest.unit,
      trend,
      isAnomaly,
    })
  }

  return trends
}

function mergeBiomarkers(
  structured: ClinicalContextBiomarker[],
  parsed?: ParsedLabValue[],
): ClinicalContextBiomarker[] {
  if (!parsed || parsed.length === 0) return structured

  const existing = new Set(structured.map((b) => b.name.toLowerCase()))
  const merged = [...structured]

  for (const lab of parsed) {
    if (!existing.has(lab.name.toLowerCase())) {
      merged.push({
        name: lab.name,
        value: lab.value,
        unit: lab.unit,
        measuredAt: new Date().toISOString(),
      })
      existing.add(lab.name.toLowerCase())
    }
  }

  return merged
}

export class PerceptionAgent implements BioAgentInterface {
  class = 'perception' as const
  name = 'Perception Agent'
  description = 'Gathers and analyzes biomarker data, medications, and supplement stack'

  async execute(step: AgentStep, context: AgentExecutionContext): Promise<AgentStepResult> {
    const start = Date.now()
    const messages: AgentMessage[] = []
    const safetyFlags: SafetyFlag[] = []

    const { clinicalContext } = context

    context.emitTrace({
      kind: 'step_progress',
      agentClass: 'perception',
      icon: '🔍',
      message: 'Analyzing latest biomarker data and health profile...',
    })

    // Merge structured biomarkers with any uploaded lab report text
    let uploadedReport: LabReportParseResult | undefined
    const uploadEntry = context.scratchpad.read('perception.lab_upload')
    if (uploadEntry?.value && typeof uploadEntry.value === 'string') {
      uploadedReport = parseLabReportText(uploadEntry.value)
    }

    if (uploadedReport && uploadedReport.values.length > 0) {
      context.emitTrace({
        kind: 'step_progress',
        agentClass: 'perception',
        icon: '📄',
        message: `Parsed lab report — found ${uploadedReport.values.length} new markers${uploadedReport.labName ? ` from ${uploadedReport.labName}` : ''}.`,
        detail: uploadedReport.values.map((v) => `${v.name}: ${v.value} ${v.unit}`).slice(0, 5).join(', ') + (uploadedReport.values.length > 5 ? ` (+${uploadedReport.values.length - 5} more)` : ''),
      })
    }

    const mergedBiomarkers = mergeBiomarkers(clinicalContext.biomarkers, uploadedReport?.values)
    const biomarkerSummary = analyzeTrends(mergedBiomarkers)
    const anomalies = biomarkerSummary.filter((b) => b.isAnomaly)

    // Detect wearable-sourced biomarkers
    const wearableSources = new Set<string>()
    for (const b of clinicalContext.biomarkers) {
      // biomarkers promoted via the bridge have source like "wearable:oura"
      const raw = (b as unknown as Record<string, unknown>).source
      if (typeof raw === 'string' && raw.startsWith('wearable:')) {
        wearableSources.add(raw.replace('wearable:', ''))
      }
    }

    if (wearableSources.size > 0) {
      context.emitTrace({
        kind: 'step_progress',
        agentClass: 'perception',
        icon: '⌚',
        message: `Wearable data from ${Array.from(wearableSources).join(', ')} integrated into analysis.`,
        detail: `${wearableSources.size} connected device${wearableSources.size !== 1 ? 's' : ''} contributing real-time health metrics`,
      })
    }

    context.emitTrace({
      kind: 'step_progress',
      agentClass: 'perception',
      icon: '📊',
      message: `Tracked ${biomarkerSummary.length} biomarkers — ${anomalies.length} anomalies detected.`,
      detail: anomalies.length > 0 ? `Anomalies: ${anomalies.map((a) => a.name).join(', ')}` : undefined,
    })

    const snapshot: PhysiologicalSnapshot = {
      biomarkerSummary,
      activeMedications: clinicalContext.medications.map((m) => ({
        name: m.name,
        dosage: m.dosage,
      })),
      activeProtocols: clinicalContext.protocols.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
      })),
      supplementStack: clinicalContext.supplementStack,
      anomalies,
      uploadedLabReport: uploadedReport,
      wearableSources: Array.from(wearableSources),
    }

    context.scratchpad.write('perception.snapshot', snapshot, 'perception')

    if (anomalies.length > 0) {
      messages.push({
        from: 'perception',
        to: 'supervisor',
        type: 'result',
        payload: { anomalyCount: anomalies.length, anomalies: anomalies.map((a) => a.name) },
        timestamp: new Date().toISOString(),
      })
    }

    if (uploadedReport && uploadedReport.values.length > 0) {
      messages.push({
        from: 'perception',
        to: 'supervisor',
        type: 'result',
        payload: {
          labUploadParsed: true,
          valuesExtracted: uploadedReport.values.length,
          labName: uploadedReport.labName,
          reportDate: uploadedReport.reportDate,
        },
        timestamp: new Date().toISOString(),
      })
    }

    context.logger.info('Perception agent completed', {
      sessionId: context.sessionId,
      biomarkerCount: biomarkerSummary.length,
      anomalyCount: anomalies.length,
    })

    return {
      outputKeys: ['perception.snapshot'],
      messages,
      safetyFlags,
      durationMs: Date.now() - start,
    }
  }
}
