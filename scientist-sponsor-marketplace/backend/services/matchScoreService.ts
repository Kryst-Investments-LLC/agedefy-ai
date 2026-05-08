import { db } from "@/lib/db"
import { toJsonValue } from "@/scientist-sponsor-marketplace/backend/models/json"
import { BaseCrudService } from "@/scientist-sponsor-marketplace/backend/services/baseCrudService"
import type { MatchScoreBreakdown } from "@/scientist-sponsor-marketplace/shared/types/entities"

export const matchScoreService = new BaseCrudService<Record<string, unknown>, Record<string, unknown>>({
  modelName: "marketplaceMatchScore",
  defaultOrderBy: [{ rank: "asc" }, { overallScore: "desc" }],
})

export async function upsertMatchScore(input: {
  discoveryId: string
  scientistId: string
  sponsorId: string
  overallScore: number
  ruleBasedScore: number
  aiAugmentedScore: number
  weightedBreakdown: MatchScoreBreakdown
  sponsorPreferenceFit: number
  metadataFit: number
  rationale: string
  rank: number
}) {
  return db.marketplaceMatchScore.upsert({
    where: {
      discoveryId_sponsorId: {
        discoveryId: input.discoveryId,
        sponsorId: input.sponsorId,
      },
    },
    create: {
      discoveryId: input.discoveryId,
      scientistId: input.scientistId,
      sponsorId: input.sponsorId,
      overallScore: input.overallScore,
      ruleBasedScore: input.ruleBasedScore,
      aiAugmentedScore: input.aiAugmentedScore,
      weightedBreakdown: toJsonValue(input.weightedBreakdown),
      sponsorPreferenceFit: input.sponsorPreferenceFit,
      metadataFit: input.metadataFit,
      rationale: input.rationale,
      rank: input.rank,
    },
    update: {
      overallScore: input.overallScore,
      ruleBasedScore: input.ruleBasedScore,
      aiAugmentedScore: input.aiAugmentedScore,
      weightedBreakdown: toJsonValue(input.weightedBreakdown),
      sponsorPreferenceFit: input.sponsorPreferenceFit,
      metadataFit: input.metadataFit,
      rationale: input.rationale,
      rank: input.rank,
    },
  })
}
