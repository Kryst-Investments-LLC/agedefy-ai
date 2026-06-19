/**
 * Cycle Report Generator — Tier 4.4
 *
 * Produces a structured summary of a completed loop cycle:
 *   - Biomarker movements vs predictions
 *   - Protocol performance summary
 *   - Digital twin accuracy metrics
 *   - Reflection agent insights
 *   - Next-cycle recommendations
 *
 * Output labeled "Research analysis — not medical advice."
 * Auth: the user themselves or their assigned clinician.
 */

import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export const CYCLE_REPORT_DISCLAIMER =
  "Research analysis generated from your cycle data — not medical advice. Findings should be reviewed by a qualified clinician before taking any action."

export interface BiomarkerSummaryEntry {
  name: string
  startValue: number | null
  endValue: number | null
  delta: number | null
  direction: "up" | "down" | "stable" | "unknown"
  predictedDelta: number | null
  accuracyVsPrediction: "within_range" | "over_response" | "under_response" | "opposite" | "unpredicted"
}

export interface CycleReport {
  loopCycleId: string
  userId: string
  cycleStartedAt: string
  cycleCompletedAt: string | null
  disclaimer: string
  biomarkerSummary: BiomarkerSummaryEntry[]
  protocolPerformance: {
    protocolId: string | null
    overallEfficacy: number | null
    targetBiomarkerCount: number
    biomarkersImproved: number
    biomarkersWorsened: number
    biomarkersUnchanged: number
  }
  twinAccuracy: {
    twinPredictionAccuracy: number | null
    twinAccuracyDelta: number | null
    interpretation: string
  }
  agentInsights: string[]
  nextCycleRecommendations: string[]
  generatedAt: string
}

export async function generateCycleReport(loopCycleId: string): Promise<CycleReport | null> {
  try {
    const cycle = await db.loopCycle.findUnique({
      where: { id: loopCycleId },
      include: {
        protocolOutcome: true,
        reflectionReport: true,
        snapshot: {
          select: {
            biomarkersJson: true,
            activeProtocolId: true,
          },
        },
      },
    })

    if (!cycle) {
      logger.warn("generateCycleReport: cycle not found", { loopCycleId })
      return null
    }

    const outcome = cycle.protocolOutcome
    const reflection = cycle.reflectionReport

    // Build biomarker summary
    const biomarkerSummary: BiomarkerSummaryEntry[] = []

    if (outcome) {
      const targets = (Array.isArray(outcome.targetBiomarkers) ? outcome.targetBiomarkers : []) as Array<{
        name: string
        predictedDelta: number
        predictedDirection: string
      }>
      const observed = (Array.isArray(outcome.observedBiomarkers) ? outcome.observedBiomarkers : []) as Array<{
        name: string
        observedDelta: number
        observedDirection: string
        confidence: number
      }>

      const observedMap = new Map(observed.map((o) => [o.name, o]))

      for (const target of targets) {
        const obs = observedMap.get(target.name)
        const delta = obs?.observedDelta ?? null

        let accuracyVsPrediction: BiomarkerSummaryEntry["accuracyVsPrediction"] = "unpredicted"
        if (obs && target.predictedDelta !== 0) {
          const ratio = delta !== null ? delta / target.predictedDelta : null
          if (ratio === null) accuracyVsPrediction = "unpredicted"
          else if (ratio < 0) accuracyVsPrediction = "opposite"
          else if (ratio < 0.5) accuracyVsPrediction = "under_response"
          else if (ratio > 1.5) accuracyVsPrediction = "over_response"
          else accuracyVsPrediction = "within_range"
        }

        const direction: BiomarkerSummaryEntry["direction"] =
          delta === null ? "unknown"
          : delta > 0.01 ? "up"
          : delta < -0.01 ? "down"
          : "stable"

        biomarkerSummary.push({
          name: target.name,
          startValue: null, // Would need to query biomarker history
          endValue: null,
          delta,
          direction,
          predictedDelta: target.predictedDelta,
          accuracyVsPrediction,
        })
      }
    }

    // Protocol performance
    const observed = outcome
      ? (Array.isArray(outcome.observedBiomarkers) ? outcome.observedBiomarkers : []) as Array<{
          observedDelta: number
          observedDirection: string
        }>
      : []

    const targets = outcome
      ? (Array.isArray(outcome.targetBiomarkers) ? outcome.targetBiomarkers : []) as Array<{
          predictedDirection: string
        }>
      : []

    let biomarkersImproved = 0
    let biomarkersWorsened = 0
    let biomarkersUnchanged = 0

    for (let i = 0; i < observed.length; i++) {
      const obs = observed[i]
      const tgt = targets[i]
      if (!tgt) continue
      // "improved" means observed direction matches predicted direction
      if (obs.observedDirection === tgt.predictedDirection) biomarkersImproved++
      else if (obs.observedDirection === "stable") biomarkersUnchanged++
      else biomarkersWorsened++
    }

    // Twin accuracy interpretation
    const twinAccuracy = outcome?.twinPredictionAccuracy ?? null
    const twinDelta = (reflection?.twinAccuracyDelta as number | null | undefined) ?? null

    let twinInterpretation = "Insufficient data to evaluate twin accuracy."
    if (twinAccuracy !== null) {
      if (twinAccuracy >= 0.8) twinInterpretation = "High accuracy — twin predictions closely matched observations."
      else if (twinAccuracy >= 0.6) twinInterpretation = "Moderate accuracy — twin predictions partially matched observations."
      else twinInterpretation = "Low accuracy — twin model may need recalibration."
    }

    // Insights from reflection
    const insights = reflection
      ? ((Array.isArray(reflection.insights) ? reflection.insights : []) as string[])
      : []

    // Next cycle recommendations (derived from insights and protocol performance)
    const nextCycleRecs: string[] = []
    if (biomarkersWorsened > 0) {
      nextCycleRecs.push(`${biomarkersWorsened} biomarker(s) moved in an unfavorable direction — protocol review recommended.`)
    }
    if (twinAccuracy !== null && twinAccuracy < 0.6) {
      nextCycleRecs.push("Digital twin accuracy is below 60% — additional biomarker measurements may improve calibration.")
    }
    if (biomarkersImproved === observed.length && observed.length > 0) {
      nextCycleRecs.push("All target biomarkers improved as predicted — consider extending the current protocol cycle.")
    }
    if (nextCycleRecs.length === 0) {
      nextCycleRecs.push("Continue current protocol and collect another cycle of biomarker measurements for comparison.")
    }

    const report: CycleReport = {
      loopCycleId,
      userId: cycle.userId,
      cycleStartedAt: cycle.cycleStart.toISOString(),
      cycleCompletedAt: cycle.completedAt?.toISOString() ?? null,
      disclaimer: CYCLE_REPORT_DISCLAIMER,
      biomarkerSummary,
      protocolPerformance: {
        protocolId: outcome?.protocolId ?? null,
        overallEfficacy: outcome?.overallEfficacy ?? null,
        targetBiomarkerCount: targets.length,
        biomarkersImproved,
        biomarkersWorsened,
        biomarkersUnchanged,
      },
      twinAccuracy: {
        twinPredictionAccuracy: twinAccuracy,
        twinAccuracyDelta: twinDelta,
        interpretation: twinInterpretation,
      },
      agentInsights: insights,
      nextCycleRecommendations: nextCycleRecs,
      generatedAt: new Date().toISOString(),
    }

    logger.info("CycleReport generated", { loopCycleId, userId: cycle.userId })
    return report
  } catch (err) {
    logger.error("generateCycleReport failed", { loopCycleId, error: String(err) })
    return null
  }
}
