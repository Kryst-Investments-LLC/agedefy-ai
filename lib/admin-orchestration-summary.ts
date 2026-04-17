export const adminOrchestrationQueueOrder = ["AI", "INGESTION", "NOTIFICATION", "GOVERNANCE"] as const
export const adminOrchestrationJobStatuses = ["QUEUED", "LEASED", "SUCCEEDED", "FAILED", "DEAD_LETTER", "CANCELED"] as const
export const adminOrchestrationStaleThresholdMinutes = 30
export const adminOrchestrationAutoRefreshOptions = [
  { seconds: 0, label: "Manual" },
  { seconds: 30, label: "30 seconds" },
  { seconds: 60, label: "1 minute" },
  { seconds: 300, label: "5 minutes" },
] as const

export type AdminOrchestrationQueue = (typeof adminOrchestrationQueueOrder)[number]
export type AdminOrchestrationJobStatus = (typeof adminOrchestrationJobStatuses)[number]
export type AdminOrchestrationQueueFilter = AdminOrchestrationQueue | "ALL"

export type AdminOrchestrationJobStatusCounts = Record<AdminOrchestrationJobStatus, number>

export type AdminOrchestrationQueueSummary = {
  queue: AdminOrchestrationQueue
  counts: AdminOrchestrationJobStatusCounts
  backlogCount: number
  deadLetterCount: number
  inFlightCount: number
  terminalCount: number
  oldestBacklogAt: string | null
  oldestDeadLetterAt: string | null
}

export type AdminOrchestrationTenantSummary = {
  totals: AdminOrchestrationJobStatusCounts
  backlogCount: number
  deadLetterCount: number
  inFlightCount: number
  terminalCount: number
  queues: Record<AdminOrchestrationQueue, AdminOrchestrationQueueSummary>
}

export type AdminOrchestrationSummaryResponse = {
  tenantId: string
  generatedAt: string
  summary: AdminOrchestrationTenantSummary
}

export type AdminOrchestrationVisibleSummary = {
  totals: AdminOrchestrationJobStatusCounts
  backlogCount: number
  deadLetterCount: number
  inFlightCount: number
  terminalCount: number
  queueCount: number
}

export type AdminOrchestrationTimestampAge = {
  ageMinutes: number | null
  ageLabel: string | null
}

export type AdminOrchestrationQueueStaleness = {
  staleAfterMinutes: number
  backlog: AdminOrchestrationTimestampAge & { isStale: boolean }
  deadLetter: AdminOrchestrationTimestampAge & { isStale: boolean }
  isStale: boolean
}

export function buildAdminJobsApiPath(filters: {
  queue?: AdminOrchestrationQueue
  status?: AdminOrchestrationJobStatus
  jobType?: string
} = {}) {
  const params = new URLSearchParams()

  if (filters.queue) {
    params.set("queue", filters.queue)
  }

  if (filters.status) {
    params.set("status", filters.status)
  }

  if (filters.jobType) {
    params.set("jobType", filters.jobType)
  }

  const query = params.toString()

  return query ? `/api/admin/jobs?${query}` : "/api/admin/jobs"
}

export function getAdminOrchestrationQueueTone(summary: Pick<AdminOrchestrationQueueSummary, "deadLetterCount" | "backlogCount" | "inFlightCount">) {
  if (summary.deadLetterCount > 0) {
    return "critical" as const
  }

  if (summary.backlogCount > 0 || summary.inFlightCount > 0) {
    return "active" as const
  }

  return "idle" as const
}

export function summarizeAdminOrchestrationQueues(queueSummaries: AdminOrchestrationQueueSummary[]): AdminOrchestrationVisibleSummary {
  const totals = Object.fromEntries(adminOrchestrationJobStatuses.map((status) => [status, 0])) as AdminOrchestrationJobStatusCounts
  let backlogCount = 0
  let deadLetterCount = 0
  let inFlightCount = 0
  let terminalCount = 0

  for (const queueSummary of queueSummaries) {
    for (const status of adminOrchestrationJobStatuses) {
      totals[status] += queueSummary.counts[status]
    }

    backlogCount += queueSummary.backlogCount
    deadLetterCount += queueSummary.deadLetterCount
    inFlightCount += queueSummary.inFlightCount
    terminalCount += queueSummary.terminalCount
  }

  return {
    totals,
    backlogCount,
    deadLetterCount,
    inFlightCount,
    terminalCount,
    queueCount: queueSummaries.length,
  }
}

export function formatAdminOrchestrationAge(value: string | null, now = Date.now()) {
  const ageMinutes = getTimestampAgeMinutes(value, now)

  if (ageMinutes === null) {
    return null
  }

  if (ageMinutes < 1) {
    return "just now"
  }

  if (ageMinutes < 60) {
    return `${ageMinutes}m old`
  }

  const ageHours = Math.floor(ageMinutes / 60)

  if (ageHours < 24) {
    return `${ageHours}h old`
  }

  return `${Math.floor(ageHours / 24)}d old`
}

export function getAdminOrchestrationQueueStaleness(
  summary: Pick<AdminOrchestrationQueueSummary, "backlogCount" | "deadLetterCount" | "oldestBacklogAt" | "oldestDeadLetterAt">,
  options: {
    now?: number
    staleAfterMinutes?: number
  } = {},
) {
  const now = options.now ?? Date.now()
  const staleAfterMinutes = options.staleAfterMinutes ?? adminOrchestrationStaleThresholdMinutes
  const backlogAgeMinutes = getTimestampAgeMinutes(summary.oldestBacklogAt, now)
  const deadLetterAgeMinutes = getTimestampAgeMinutes(summary.oldestDeadLetterAt, now)
  const backlogAgeLabel = formatAdminOrchestrationAge(summary.oldestBacklogAt, now)
  const deadLetterAgeLabel = formatAdminOrchestrationAge(summary.oldestDeadLetterAt, now)
  const backlogIsStale = summary.backlogCount > 0 && backlogAgeMinutes !== null && backlogAgeMinutes >= staleAfterMinutes
  const deadLetterIsStale = summary.deadLetterCount > 0 && deadLetterAgeMinutes !== null && deadLetterAgeMinutes >= staleAfterMinutes

  return {
    staleAfterMinutes,
    backlog: {
      ageMinutes: backlogAgeMinutes,
      ageLabel: backlogAgeLabel,
      isStale: backlogIsStale,
    },
    deadLetter: {
      ageMinutes: deadLetterAgeMinutes,
      ageLabel: deadLetterAgeLabel,
      isStale: deadLetterIsStale,
    },
    isStale: backlogIsStale || deadLetterIsStale,
  } satisfies AdminOrchestrationQueueStaleness
}

function getTimestampAgeMinutes(value: string | null, now: number) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return Math.max(0, Math.floor((now - parsed.getTime()) / 60_000))
}