/**
 * Cancer-specific helpers.
 *
 * Thin readers that turn TumorProfile + CtdnaTimepoint + RecistAssessment
 * into structured signals the discovery / safety agents can cite as
 * evidence (`AgentClaimEvidenceKind.COHORT_STATISTIC` for population-level
 * stats; `MECHANISTIC_SIMULATION` for per-patient kinetic projections).
 */

import { db } from "@/lib/db"
import { safeJsonParse } from "@/lib/safe-json"

export interface CtdnaTrajectory {
  measuredAt: Date
  vafMax: number | null
  copiesPerMl: number | null
  mrdStatus: string
}

export interface CtdnaTrend {
  windowDays: number
  firstVaf: number | null
  lastVaf: number | null
  doublingTimeDays: number | null
  mrdConversion: "NEG_TO_POS" | "POS_TO_NEG" | "STABLE_NEG" | "STABLE_POS" | "UNKNOWN"
}

export async function loadCtdnaTrajectory(
  tumorProfileId: string,
  windowDays = 365,
): Promise<CtdnaTrajectory[]> {
  const since = new Date()
  since.setDate(since.getDate() - windowDays)
  const points = await db.ctdnaTimepoint.findMany({
    where: { tumorProfileId, measuredAt: { gte: since } },
    orderBy: { measuredAt: "asc" },
    take: 500,
    select: { measuredAt: true, vafMax: true, copiesPerMl: true, mrdStatus: true },
  })
  return points
}

export function summarizeCtdnaTrend(points: CtdnaTrajectory[], windowDays = 365): CtdnaTrend {
  if (points.length === 0) {
    return {
      windowDays,
      firstVaf: null,
      lastVaf: null,
      doublingTimeDays: null,
      mrdConversion: "UNKNOWN",
    }
  }
  const first = points[0]
  const last = points[points.length - 1]
  let doublingTimeDays: number | null = null
  if (first.vafMax && last.vafMax && first.vafMax > 0 && last.vafMax > 0) {
    const days = (last.measuredAt.getTime() - first.measuredAt.getTime()) / 86_400_000
    const ratio = last.vafMax / first.vafMax
    if (days > 0 && ratio > 0 && ratio !== 1) {
      doublingTimeDays = (days * Math.log(2)) / Math.log(ratio)
    }
  }
  const conv = ((): CtdnaTrend["mrdConversion"] => {
    const a = first.mrdStatus
    const b = last.mrdStatus
    if (a === "NEGATIVE" && b === "POSITIVE") return "NEG_TO_POS"
    if (a === "POSITIVE" && b === "NEGATIVE") return "POS_TO_NEG"
    if (a === "NEGATIVE" && b === "NEGATIVE") return "STABLE_NEG"
    if (a === "POSITIVE" && b === "POSITIVE") return "STABLE_POS"
    return "UNKNOWN"
  })()
  return {
    windowDays,
    firstVaf: first.vafMax,
    lastVaf: last.vafMax,
    doublingTimeDays,
    mrdConversion: conv,
  }
}

export interface NeoantigenCandidate {
  peptide: string
  hla: string
  affinity_nM: number
}

export async function getNeoantigens(tumorProfileId: string): Promise<NeoantigenCandidate[]> {
  const profile = await db.tumorProfile.findUnique({
    where: { id: tumorProfileId },
    select: { neoantigensJson: true },
  })
  if (!profile?.neoantigensJson) return []
  return (profile.neoantigensJson as unknown as NeoantigenCandidate[]) ?? []
}
