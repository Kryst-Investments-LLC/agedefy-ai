/**
 * Dynamic Recommendations Engine
 *
 * Analyzes a user's biomarkers, protocols, and the knowledge graph to produce
 * ranked, evidence-grounded recommendations.
 */

import type { Prisma } from "@prisma/client"

export interface Recommendation {
  type: "compound" | "protocol_adjustment" | "lab_panel" | "research"
  title: string
  reason: string
  relevanceScore: number
  evidenceQuality: "high" | "moderate" | "low"
  relatedPathway?: string
  relatedEntityId?: string
  relatedEntityType?: string
  /** Aggregate outcome support (from flywheel) */
  aggregateSupport?: {
    sampleSize: number
    meanOutcomeScore: number
    period: string
  }
  /** FL model prediction support */
  flPrediction?: {
    predictedDelta: number
    confidence: number
    modelVersion: number
  }
}

interface UserBiomarkerSummary {
  name: string
  value: number
  unit: string
  target: number | null
  trend: string | null
}

interface CompoundPathwayRecord {
  compound: { id: string; name: string; mechanism: string | null }
  pathway: { id: string; name: string; category: string | null }
}

interface LabPanelRecord {
  id: string
  name: string
  description: string | null
  biomarkers: Prisma.JsonValue
}

/**
 * Score how far a biomarker is from its target.
 * Returns 0 (on target) to 1 (very far from target).
 */
function targetGapScore(value: number, target: number | null): number {
  if (target === null || target === 0) return 0.5
  const ratio = Math.abs(value - target) / target
  return Math.min(ratio, 1)
}

/**
 * Generate compound recommendations based on the user's weakest biomarker pathways.
 */
function generateCompoundRecommendations(
  biomarkers: UserBiomarkerSummary[],
  compoundPathways: CompoundPathwayRecord[],
): Recommendation[] {
  const results: Recommendation[] = []

  const weakBiomarkers = biomarkers
    .filter((b) => b.target !== null)
    .map((b) => ({ ...b, gap: targetGapScore(b.value, b.target) }))
    .filter((b) => b.gap > 0.15)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 5)

  if (weakBiomarkers.length === 0) return results

  for (const cp of compoundPathways) {
    const pathwayName = cp.pathway.name.toLowerCase()
    const mechanism = (cp.compound.mechanism ?? "").toLowerCase()

    const relevantBiomarker = weakBiomarkers.find(
      (b) =>
        pathwayName.includes(b.name.toLowerCase()) ||
        mechanism.includes(b.name.toLowerCase()),
    )

    if (relevantBiomarker) {
      results.push({
        type: "compound",
        title: `Consider ${cp.compound.name}`,
        reason: `Your ${relevantBiomarker.name} is ${Math.round(relevantBiomarker.gap * 100)}% from target. ${cp.compound.name} targets the ${cp.pathway.name} pathway.`,
        relevanceScore: Math.round(relevantBiomarker.gap * 100) / 100,
        evidenceQuality: "moderate",
        relatedPathway: cp.pathway.name,
        relatedEntityId: cp.compound.id,
        relatedEntityType: "Compound",
      })
    }
  }

  return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5)
}

/**
 * Generate lab panel recommendations based on tracked biomarkers.
 */
function generateLabPanelRecommendations(
  biomarkers: UserBiomarkerSummary[],
  labPanels: LabPanelRecord[],
): Recommendation[] {
  const results: Recommendation[] = []
  const trackedNames = new Set(biomarkers.map((b) => b.name.toLowerCase()))

  for (const panel of labPanels) {
    const panelBiomarkers: string[] = Array.isArray(panel.biomarkers)
      ? (panel.biomarkers as string[])
      : []

    const matchCount = panelBiomarkers.filter((name) =>
      trackedNames.has(String(name).toLowerCase()),
    ).length

    if (matchCount > 0) {
      results.push({
        type: "lab_panel",
        title: `Retest with ${panel.name}`,
        reason: `${matchCount} of your tracked biomarkers are covered by this panel.`,
        relevanceScore: matchCount / Math.max(panelBiomarkers.length, 1),
        evidenceQuality: "high",
        relatedEntityId: panel.id,
        relatedEntityType: "LabTestPanel",
      })
    }
  }

  return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3)
}

/**
 * Generate protocol adjustment recommendations.
 */
function generateProtocolAdjustments(
  biomarkers: UserBiomarkerSummary[],
): Recommendation[] {
  const declining = biomarkers.filter((b) => b.trend === "DOWN" && b.target !== null)

  return declining.slice(0, 3).map((b) => ({
    type: "protocol_adjustment" as const,
    title: `Review protocol for declining ${b.name}`,
    reason: `${b.name} is trending down (current: ${b.value} ${b.unit}, target: ${b.target}).`,
    relevanceScore: targetGapScore(b.value, b.target),
    evidenceQuality: "moderate" as const,
  }))
}

export interface AggregateOutcomeRecord {
  protocolId?: string | null
  compoundId?: string | null
  cohortBucket: string
  sampleSize: number
  meanOutcomeScore: number
  period: string
}

/** FL model prediction for a compound or protocol */
export interface FLPredictionRecord {
  entityId: string
  entityType: 'Compound' | 'Protocol'
  predictedDelta: number
  confidence: number
  modelVersion: number
}

export function generateRecommendations(input: {
  biomarkers: UserBiomarkerSummary[]
  compoundPathways: CompoundPathwayRecord[]
  labPanels: LabPanelRecord[]
  /** Optional: aggregate outcomes from the flywheel to boost confidence */
  aggregateOutcomes?: AggregateOutcomeRecord[]
  /** Optional: FL model predictions to further rank recommendations */
  flPredictions?: FLPredictionRecord[]
}): Recommendation[] {
  const all: Recommendation[] = [
    ...generateCompoundRecommendations(input.biomarkers, input.compoundPathways),
    ...generateProtocolAdjustments(input.biomarkers),
    ...generateLabPanelRecommendations(input.biomarkers, input.labPanels),
  ]

  // Boost recommendations that have supporting aggregate outcome data
  if (input.aggregateOutcomes && input.aggregateOutcomes.length > 0) {
    for (const rec of all) {
      const match = input.aggregateOutcomes.find(
        (ao) =>
          (ao.compoundId && ao.compoundId === rec.relatedEntityId) ||
          (ao.protocolId && ao.protocolId === rec.relatedEntityId),
      )

      if (match && match.meanOutcomeScore > 0 && match.sampleSize >= 5) {
        // Boost relevance by up to 20% based on positive aggregate outcomes
        const boost = Math.min(match.meanOutcomeScore * 0.2, 0.2)
        rec.relevanceScore = Math.min(rec.relevanceScore + boost, 1)
        rec.aggregateSupport = {
          sampleSize: match.sampleSize,
          meanOutcomeScore: match.meanOutcomeScore,
          period: match.period,
        }
        // Upgrade evidence quality if aggregate data supports it
        if (match.sampleSize >= 30 && rec.evidenceQuality === 'moderate') {
          rec.evidenceQuality = 'high'
        }
      }
    }
  }

  // Blend FL model predictions into recommendations
  if (input.flPredictions && input.flPredictions.length > 0) {
    for (const rec of all) {
      const flMatch = input.flPredictions.find(
        (fp) => fp.entityId === rec.relatedEntityId && fp.entityType === rec.relatedEntityType,
      )

      if (flMatch && flMatch.confidence >= 0.5) {
        // Boost relevance by up to 15% based on FL-predicted improvement
        const deltaBoost = Math.min(Math.max(flMatch.predictedDelta * 0.15, 0), 0.15)
        rec.relevanceScore = Math.min(rec.relevanceScore + deltaBoost, 1)
        rec.flPrediction = {
          predictedDelta: flMatch.predictedDelta,
          confidence: flMatch.confidence,
          modelVersion: flMatch.modelVersion,
        }
        // High-confidence FL predictions can upgrade evidence quality
        if (flMatch.confidence >= 0.8 && rec.evidenceQuality === 'low') {
          rec.evidenceQuality = 'moderate'
        }
      }
    }
  }

  return all.sort((a, b) => b.relevanceScore - a.relevanceScore)
}
