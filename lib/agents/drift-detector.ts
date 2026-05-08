import { db } from '@/lib/db'

export type DriftDirection = 'rising' | 'falling'

export type DriftFinding = {
  biomarkerName: string
  direction: DriftDirection
  changePercent: number
  currentValue: number
  baselineValue: number
  unit: string
  windowDays: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  reason: string
}

export type DriftSweepResult = {
  userId: string
  biomarkersScanned: number
  findings: DriftFinding[]
}

// ─── Thresholds ────────────────────────────────────────────

const DRIFT_WINDOW_DAYS = 14
const MINIMUM_READINGS = 2

/**
 * Percentage change thresholds that map to severity levels.
 * e.g., 15% change = medium, 25% = high, 40% = critical
 */
const SEVERITY_THRESHOLDS: { min: number; severity: DriftFinding['severity'] }[] = [
  { min: 40, severity: 'critical' },
  { min: 25, severity: 'high' },
  { min: 15, severity: 'medium' },
  { min: 8, severity: 'low' },
]

function classifySeverity(changePercent: number): DriftFinding['severity'] | null {
  const abs = Math.abs(changePercent)
  for (const threshold of SEVERITY_THRESHOLDS) {
    if (abs >= threshold.min) return threshold.severity
  }
  return null
}

// ─── Core Detection ────────────────────────────────────────

/**
 * Runs a lightweight perception sweep for a single user.
 * Queries the last `DRIFT_WINDOW_DAYS` of biomarker data and detects
 * meaningful directional change above the severity thresholds.
 */
export async function detectDrift(userId: string): Promise<DriftSweepResult> {
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - DRIFT_WINDOW_DAYS)

  const recentBiomarkers = await db.biomarker.findMany({
    where: {
      userId,
      measuredAt: { gte: windowStart },
    },
    orderBy: { measuredAt: 'asc' },
    select: { name: true, value: true, unit: true, measuredAt: true },
  })

  // Group by biomarker name
  const grouped = new Map<string, { value: number; unit: string; measuredAt: Date }[]>()
  for (const b of recentBiomarkers) {
    const existing = grouped.get(b.name) ?? []
    existing.push(b)
    grouped.set(b.name, existing)
  }

  const findings: DriftFinding[] = []

  for (const [name, readings] of grouped) {
    if (readings.length < MINIMUM_READINGS) continue

    const sorted = [...readings].sort(
      (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime(),
    )

    // Use earliest reading in window as baseline, latest as current
    const baseline = sorted[0]
    const current = sorted[sorted.length - 1]

    // Avoid division by zero
    if (baseline.value === 0) continue

    const changePercent = ((current.value - baseline.value) / Math.abs(baseline.value)) * 100
    const severity = classifySeverity(changePercent)

    if (!severity) continue

    const direction: DriftDirection = changePercent > 0 ? 'rising' : 'falling'
    const daySpan = Math.round(
      (current.measuredAt.getTime() - baseline.measuredAt.getTime()) / (1000 * 60 * 60 * 24),
    )

    findings.push({
      biomarkerName: name,
      direction,
      changePercent: Math.round(changePercent * 10) / 10,
      currentValue: current.value,
      baselineValue: baseline.value,
      unit: current.unit,
      windowDays: daySpan || 1,
      severity,
      reason: `${name} has ${direction === 'rising' ? 'increased' : 'decreased'} ${Math.abs(Math.round(changePercent))}% over ${daySpan} days (${baseline.value} → ${current.value} ${current.unit}).`,
    })
  }

  // Sort by severity (critical first)
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  findings.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4))

  return {
    userId,
    biomarkersScanned: grouped.size,
    findings,
  }
}
