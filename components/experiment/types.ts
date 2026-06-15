import type {
  ExperimentCandidate,
  ExperimentCandidateEvent,
  CandidateLabResult,
  ExperimentCandidateStatus,
  ExperimentCandidateKind,
} from '@prisma/client'

export type { ExperimentCandidateStatus, ExperimentCandidateKind }

export type CandidateSummary = ExperimentCandidate & {
  _count: { labResults: number; events: number }
}

export type CandidateDetail = ExperimentCandidate & {
  events: ExperimentCandidateEvent[]
  labResults: CandidateLabResult[]
}

export const LIFECYCLE_LABELS: Record<ExperimentCandidateStatus, string> = {
  PROPOSED: 'Proposed',
  SCREENED: 'Screened',
  SENT_TO_LAB: 'Sent to Lab',
  RESULT_LOGGED: 'Result Logged',
  FED_BACK: 'Fed Back',
}

export const LIFECYCLE_ORDER: ExperimentCandidateStatus[] = [
  'PROPOSED',
  'SCREENED',
  'SENT_TO_LAB',
  'RESULT_LOGGED',
  'FED_BACK',
]

export const NEXT_STATUS: Partial<Record<ExperimentCandidateStatus, ExperimentCandidateStatus>> = {
  PROPOSED: 'SCREENED',
  SCREENED: 'SENT_TO_LAB',
  SENT_TO_LAB: 'RESULT_LOGGED',
  RESULT_LOGGED: 'FED_BACK',
}

export const STATUS_COLORS: Record<ExperimentCandidateStatus, string> = {
  PROPOSED:
    'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 border-gray-200 dark:border-slate-700',
  SCREENED:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  SENT_TO_LAB:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  RESULT_LOGGED:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  FED_BACK:
    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800',
}

export const COLUMN_BG: Record<ExperimentCandidateStatus, string> = {
  PROPOSED: 'bg-gray-50 dark:bg-slate-900/50',
  SCREENED: 'bg-blue-50/50 dark:bg-blue-950/20',
  SENT_TO_LAB: 'bg-purple-50/50 dark:bg-purple-950/20',
  RESULT_LOGGED: 'bg-amber-50/50 dark:bg-amber-950/20',
  FED_BACK: 'bg-green-50/50 dark:bg-green-950/20',
}
