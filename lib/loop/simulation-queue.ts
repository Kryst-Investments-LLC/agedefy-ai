/**
 * Simulation Priority Queue — Tier 3.3
 *
 * Decides which digital-twin simulations to auto-queue next, ranked by
 * expected informational value:
 *
 *   expected_value = uncertainty_score × pathway_importance × freshness_decay
 *
 * Sims older than 30 days get a +50% uncertainty bonus (freshness_decay > 1).
 * The top-N highest-value sims are flagged for auto-queuing.
 */

export interface RecentSimulation {
  id: string
  interventionId: string
  endpointName: string
  /** ISO timestamp of when the simulation was run */
  simulatedAt: string
  /** 0–1: model's own estimate of prediction uncertainty */
  uncertaintyScore: number
}

export interface PathwayPriority {
  pathway: string
  /** 0–1: from the InvestigationPlan / dysregulation score */
  importance: number
}

/** Which endpoint→pathway mappings exist so we can look up pathway importance */
const ENDPOINT_PATHWAY_MAP: Record<string, string> = {
  hs_crp:      "NF-kB / Inflammation",
  crp:         "NF-kB / Inflammation",
  il_6:        "NF-kB / Inflammation",
  hba1c:       "Insulin Resistance / mTOR",
  glucose:     "Insulin Resistance / mTOR",
  homa_ir:     "Insulin Resistance / mTOR",
  vo2max:      "AMPK / Mitochondrial",
  lactate:     "AMPK / Mitochondrial",
  nad:         "NAD+ / Sirtuin",
  p21:         "Cellular Senescence",
  gdf_15:      "Cellular Senescence",
  cortisol:    "HPA Axis / Cortisol",
  dheas:       "HPA Axis / Cortisol",
  igf1:        "GH / IGF-1 Axis",
  tsh:         "Thyroid",
  ldl:         "Cardiovascular / Lipid",
  apob:        "Cardiovascular / Lipid",
  triglycerides: "Cardiovascular / Lipid",
  egfr:        "Renal Function",
  creatinine:  "Renal Function",
  alt:         "Liver / Metabolic",
  ast:         "Liver / Metabolic",
  testosterone: "Sex Hormones",
  estradiol:   "Sex Hormones",
}

const STALE_THRESHOLD_DAYS = 30
const STALE_UNCERTAINTY_BONUS = 1.5 // +50%

export interface SimulationPriority {
  interventionId: string
  endpointName: string
  expectedValue: number
  uncertaintyScore: number
  pathwayImportance: number
  freshnessDecay: number
  shouldAutoQueue: boolean
  /** null when the endpoint is not mapped to any known pathway */
  matchedPathway: string | null
}

/**
 * Rank pending/stale simulations by expected informational value.
 *
 * @param priorityPathways - pathways from the InvestigationPlan (ordered by importance)
 * @param recentSims       - simulations already run; used for freshness check
 * @param topN             - auto-queue this many top-ranked sims (default 3)
 */
export function prioritizeSimulations(
  priorityPathways: PathwayPriority[],
  recentSims: RecentSimulation[],
  topN = 3,
): SimulationPriority[] {
  const now = Date.now()

  // Build importance lookup: pathway name → 0–1 score
  // Higher rank in the list → higher importance; if no list use 0.5 baseline
  const importanceLookup = new Map<string, number>()
  const total = priorityPathways.length
  for (let i = 0; i < total; i++) {
    // First pathway in list = highest importance
    importanceLookup.set(priorityPathways[i].pathway, priorityPathways[i].importance)
  }

  const scored: SimulationPriority[] = recentSims.map((sim) => {
    const matchedPathway = ENDPOINT_PATHWAY_MAP[sim.endpointName] ?? null
    const pathwayImportance = matchedPathway ? (importanceLookup.get(matchedPathway) ?? 0.3) : 0.3

    const ageMs = now - new Date(sim.simulatedAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    const freshnessDecay = ageDays > STALE_THRESHOLD_DAYS ? STALE_UNCERTAINTY_BONUS : 1.0

    const effectiveUncertainty = Math.min(1, sim.uncertaintyScore * freshnessDecay)
    const expectedValue = effectiveUncertainty * pathwayImportance * freshnessDecay

    return {
      interventionId: sim.interventionId,
      endpointName: sim.endpointName,
      expectedValue,
      uncertaintyScore: sim.uncertaintyScore,
      pathwayImportance,
      freshnessDecay,
      shouldAutoQueue: false,
      matchedPathway,
    }
  })

  // Sort descending by expected value
  scored.sort((a, b) => b.expectedValue - a.expectedValue)

  // Mark top-N for auto-queuing
  for (let i = 0; i < Math.min(topN, scored.length); i++) {
    if (scored[i].expectedValue > 0) {
      scored[i].shouldAutoQueue = true
    }
  }

  return scored
}
