import type { UserClinicalContext } from '@/lib/ai/clinical-context'
import type { logger } from '@/lib/logger'

import type { Scratchpad } from './scratchpad'

export type AgentClass = 'perception' | 'discovery' | 'protocol' | 'safety' | 'explainability'

export type AgentSessionStatus = 'planning' | 'running' | 'paused' | 'awaiting_review' | 'completed' | 'failed'

export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export type ScratchpadEntry = {
  key: string
  value: unknown
  writtenBy: AgentClass
  timestamp: string
  ttlMs?: number
}

export type AgentMessage = {
  from: AgentClass
  to: AgentClass | 'supervisor'
  type: 'result' | 'request' | 'error' | 'safety_flag'
  payload: unknown
  timestamp: string
}

export type AgentStep = {
  index: number
  agentClass: AgentClass
  description: string
  toolCalls: string[]
  expectedOutputKeys: string[]
  verificationCriteria?: string
  status: AgentStepStatus
  result?: unknown
  error?: string
  durationMs?: number
}

export type AgentPlan = {
  goal: string
  steps: AgentStep[]
  createdAt: string
  revisedAt?: string
}

export type SafetyFlag = {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  source: AgentClass
  requiresClinicianReview: boolean
  createdAt: string
}

export type AgentResult = {
  sessionId: string
  status: AgentSessionStatus
  plan: AgentPlan
  scratchpad: Record<string, ScratchpadEntry>
  messages: AgentMessage[]
  summary?: string
  safetyFlags: SafetyFlag[]
  startedAt: string
  completedAt?: string
  totalDurationMs?: number
  awaitingReviewItemIds?: string[]
  resumedAt?: string
  reviewedBy?: string
}

export type LabReportUpload = {
  fileName: string
  mimeType: string
  content: string
  source: 'upload'
}

export type ParsedLabValue = {
  name: string
  value: number
  unit: string
  referenceRange?: string
  flag?: 'HIGH' | 'LOW' | 'NORMAL'
}

export type LabReportParseResult = {
  values: ParsedLabValue[]
  reportDate?: string
  labName?: string
  rawTextLength: number
}

export type HistoricalCorrelation = {
  compound: string
  biomarker: string
  trialPeriodDays: number
  startValue: number
  endValue: number
  changePercent: number
  direction: 'improved' | 'worsened' | 'unchanged'
  protocolId: string
  protocolName: string
}

export type TraceEventKind =
  | 'session_start'
  | 'plan_created'
  | 'step_start'
  | 'step_progress'
  | 'step_complete'
  | 'step_failed'
  | 'safety_flag'
  | 'governance_decision'
  | 'hitl_pause'
  | 'session_complete'
  | 'evidence'

/** A single piece of provenance behind a trace decision (paper / trial / source). */
export type TraceCitation = {
  /** Stable identifier: PMID / DOI / NCT id / internal compound-interaction id. */
  id?: string
  /** Origin: 'pubmed' | 'biorxiv' | 'clinicaltrials_gov' | 'drugbank' | 'cpic' | 'internal' | … */
  source?: string
  title?: string
  url?: string
  /** Strength of the evidence, where the source grades it (e.g. CPIC/DDI A–D). */
  evidenceGrade?: 'A' | 'B' | 'C' | 'D'
}

/**
 * Structured reasoning provenance attached to a trace event. This is what makes
 * the diagnostic reasoning tree reconstructable — the inputs a step considered,
 * the citations its conclusion rests on, and (for LLM steps) the model and
 * confidence — instead of burying it all in a free-text `message`.
 */
export type TraceEvidence = {
  /** Inputs that drove this step (e.g. the biomarker values / lab panel). */
  inputs?: Record<string, unknown>
  /** Citations / sources backing the assertion. */
  citations?: TraceCitation[]
  /** Model id, when an LLM produced this step. */
  model?: string
  /** Confidence in [0, 1], when the producer reports one. */
  confidence?: number
  /** Scratchpad key or sub-prompt id holding the full chain, if persisted elsewhere. */
  reasoningRef?: string
}

export type TraceEvent = {
  id: string
  sessionId: string
  kind: TraceEventKind
  agentClass?: AgentClass
  icon: string
  message: string
  detail?: string
  /** Structured provenance (citations, inputs, model, confidence). Optional. */
  evidence?: TraceEvidence
  timestamp: string
}

export type TraceEmitter = (event: Omit<TraceEvent, 'id' | 'sessionId' | 'timestamp'>) => void

export type AgentToolDefinition = {
  name: string
  description: string
  agentClass: AgentClass
  execute: (input: unknown, context: AgentExecutionContext) => Promise<unknown>
}

export type AgentExecutionContext = {
  sessionId: string
  userId: string
  tenantId: string
  clinicalContext: UserClinicalContext
  scratchpad: Scratchpad
  logger: typeof logger
  emitTrace: TraceEmitter
}

export type BioAgentInterface = {
  class: AgentClass
  name: string
  description: string
  execute: (step: AgentStep, context: AgentExecutionContext) => Promise<AgentStepResult>
}

export type AgentStepResult = {
  outputKeys: string[]
  messages: AgentMessage[]
  safetyFlags: SafetyFlag[]
  durationMs: number
}
