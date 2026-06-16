import type { Discovery, FundingRequest, MatchScoreBreakdown, RankedMatch, Sponsor } from "@/scientist-sponsor-marketplace/shared/types/entities"
import { clamp, computeWeightedAverage } from "@/scientist-sponsor-marketplace/shared/utils"

function overlap(left: string[], right: string[]) {
  if (!left.length || !right.length) {
    return 0
  }

  const rightSet = new Set(right.map((item) => item.toLowerCase()))
  const shared = left.filter((item) => rightSet.has(item.toLowerCase())).length
  return clamp(shared / Math.max(left.length, right.length))
}

/**
 * Compute how well a sponsor/lab's declared assay capabilities cover the
 * assays requested in a validation listing.
 *
 * Uses directional coverage: shared / requested — i.e., "what fraction of
 * the requested assays can this lab actually run?" Returns 0 when either
 * side is empty so it degrades gracefully for non-validation listings.
 */
export function computeLabCapabilityFit(requestedAssays: string[], sponsorCapabilities: string[]): number {
  if (!requestedAssays.length || !sponsorCapabilities.length) return 0
  const capSet = new Set(sponsorCapabilities.map((c) => c.toLowerCase()))
  const covered = requestedAssays.filter((a) => capSet.has(a.toLowerCase())).length
  return clamp(covered / requestedAssays.length)
}

export function computeRuleBasedScore(discovery: Discovery, sponsor: Sponsor, fundingRequest?: FundingRequest | null): MatchScoreBreakdown {
  const requestedBudget = fundingRequest?.requestedAmountCents ?? discovery.fundingGoalCents
  const categoryFit = overlap([discovery.category], sponsor.preferredCategories)
  const stageFit = overlap([discovery.developmentStage], sponsor.preferredStages)
  const impactFit = clamp(discovery.scientificImpactScore)
  const budgetFit = requestedBudget <= sponsor.maxBudgetCents ? 1 : clamp(1 - (requestedBudget - sponsor.maxBudgetCents) / requestedBudget)
  const evidenceFit = clamp((discovery.evidenceLinks.length * 0.12) + (discovery.evidenceSummary ? 0.35 : 0.15))
  const metadataFit = clamp(((Number(discovery.metadata.novelty) || 0.35) + discovery.commercialReadiness) / 2)

  return {
    categoryFit,
    budgetFit,
    impactFit,
    stageFit,
    evidenceFit,
    metadataFit,
    aiSignal: 0,
  }
}

/**
 * Compute a text-similarity signal between the discovery summary and
 * the sponsor thesis using bag-of-words token overlap (Jaccard-style).
 *
 * This is a deterministic heuristic, not an ML model or LLM call.
 * The resulting score is stored as `aiAugmentedScore` in the database
 * for backward compatibility.
 */
export function computeTextSimilarityScore(discovery: Discovery, sponsor: Sponsor) {
  const summaryTokens = discovery.summary.toLowerCase().split(/\W+/).filter(Boolean)
  const thesisTokens = sponsor.thesis.toLowerCase().split(/\W+/).filter(Boolean)
  return overlap(summaryTokens, thesisTokens)
}

export function rankDiscoveriesForSponsor(input: {
  discoveries: Discovery[]
  sponsor: Sponsor
  fundingRequests: FundingRequest[]
}): RankedMatch[] {
  const baseWeights = {
    categoryFit: 0.2,
    budgetFit: 0.2,
    impactFit: 0.2,
    stageFit: 0.12,
    evidenceFit: 0.1,
    metadataFit: 0.08,
    aiSignal: 0.1,
  }

  return input.discoveries
    .map((discovery) => {
      const fundingRequest = input.fundingRequests.find((item) => item.discoveryId === discovery.id)
      const ruleScore = computeRuleBasedScore(discovery, input.sponsor, fundingRequest)

      const isValidationListing = discovery.metadata.validationListing === true
      const requestedAssays = Array.isArray(discovery.metadata.requestedAssays)
        ? (discovery.metadata.requestedAssays as unknown[]).filter((a): a is string => typeof a === "string")
        : []
      const labCapabilityFit = isValidationListing
        ? computeLabCapabilityFit(requestedAssays, input.sponsor.assayCapabilities ?? [])
        : computeTextSimilarityScore(discovery, input.sponsor)

      const weighted = { ...ruleScore, aiSignal: labCapabilityFit }

      // When this is a validation listing with declared assay needs, boost the
      // aiSignal weight and trim metadataFit to keep weights summing to 1.
      const weights = isValidationListing && requestedAssays.length > 0
        ? { ...baseWeights, aiSignal: 0.15, metadataFit: 0.03 }
        : baseWeights

      const overallScore = computeWeightedAverage(weights, weighted)
      const ruleBasedScore = computeWeightedAverage({ ...weights, aiSignal: 0 }, weighted)

      const rationalePrefix = isValidationListing
        ? `Validation listing — lab capability ${Math.round(labCapabilityFit * 100)}%, `
        : ""

      return {
        discovery,
        score: weighted,
        overallScore,
        ruleBasedScore,
        aiAugmentedScore: labCapabilityFit,
        rationale: `${rationalePrefix}category ${Math.round(weighted.categoryFit * 100)}%, budget ${Math.round(weighted.budgetFit * 100)}%, impact ${Math.round(weighted.impactFit * 100)}%.`,
      }
    })
    .sort((left, right) => right.overallScore - left.overallScore)
}
