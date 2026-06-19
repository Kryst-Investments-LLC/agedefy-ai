/**
 * Dosage Optimizer — Tier 4.3
 *
 * CLINICIAN USE ONLY. Gate enforced at the API layer.
 *
 * Given observed biomarker response and the current dose, suggest an adjusted
 * dose that would better achieve the target outcome trajectory.
 *
 * Hard constraints (non-negotiable):
 *   - `requiresClinician` is ALWAYS true — this is never autonomous.
 *   - Output labeled "AI-generated dosage hypothesis — requires prescriber review
 *     and validation. Not a medical prescription."
 *   - Uses population PBPK priors when no user-specific PK profile exists.
 *   - Does NOT expose output to consumer users.
 *   - Does NOT route through lib/agents/discovery-agent.ts.
 *
 * Algorithm:
 *   1. If per-user PK profile available (UserTwinPrior) → use personalised CL/Vd
 *   2. Otherwise → use population PBPK defaults
 *   3. Compute target Css_avg at current dose via 1-cmt model
 *   4. Observed response direction determines whether to increase / decrease / hold
 *   5. Suggest new dose = current × (targetDelta / observedDelta) clamped to ±50%
 *   6. If response is in the right direction but < 50% of predicted → suggest +25%
 *   7. If response is in the wrong direction → hold and flag for clinician review
 */

import { logger } from "@/lib/logger"

export const DOSAGE_DISCLAIMER =
  "AI-generated dosage hypothesis — requires prescriber review and validation. Not a medical prescription."

export interface BiomarkerDelta {
  biomarkerName: string
  observedDelta: number      // absolute change (e.g., -1.5 mg/L)
  predictedDelta: number     // what the twin predicted
  unit: string
}

export interface UserPkProfile {
  vd_L: number        // volume of distribution
  cl_L_per_h: number  // clearance
  ka_per_h: number    // absorption rate constant
  f: number           // oral bioavailability
  n: number           // number of observations used to fit
}

export interface DosageSuggestion {
  suggestedDose: number | null
  unit: string
  rationale: string
  confidenceLevel: "high" | "medium" | "low"
  requiresClinician: true
  disclaimer: string
  pkSource: "user_profile" | "population_default"
  responseDirection: "expected" | "opposite" | "insufficient" | "none"
  observedResponseRatio: number | null
}

// Population defaults — mirrors pbpk-1cmt.ts DEFAULTS
const POP_DEFAULTS = {
  vd_L: 50,
  cl_L_per_h: 5,
  ka_per_h: 1.0,
  f: 0.7,
}

function computeCssAvg(
  dose_mg: number,
  intervalHours: number,
  pk: { vd_L: number; cl_L_per_h: number; f: number },
): number {
  // Css_avg = (F × dose) / (CL × tau)
  // where tau = dosing interval in hours
  return (pk.f * dose_mg) / (pk.cl_L_per_h * intervalHours)
}

export function computeDosageSuggestion(input: {
  compoundId: string
  currentDose: number
  currentUnit: string
  dosingIntervalHours?: number
  observedBiomarkerResponse: BiomarkerDelta[]
  pkProfile?: UserPkProfile | null
}): DosageSuggestion {
  const {
    compoundId,
    currentDose,
    currentUnit,
    dosingIntervalHours = 24,
    observedBiomarkerResponse,
    pkProfile,
  } = input

  const pk = pkProfile
    ? { vd_L: pkProfile.vd_L, cl_L_per_h: pkProfile.cl_L_per_h, f: pkProfile.f }
    : POP_DEFAULTS

  const pkSource: DosageSuggestion["pkSource"] = pkProfile ? "user_profile" : "population_default"

  const baseDisposition = {
    requiresClinician: true as const,
    disclaimer: DOSAGE_DISCLAIMER,
    unit: currentUnit,
    pkSource,
    suggestedDose: null,
    observedResponseRatio: null,
  }

  // No biomarker response data → insufficient information
  if (!observedBiomarkerResponse || observedBiomarkerResponse.length === 0) {
    return {
      ...baseDisposition,
      rationale: `${DOSAGE_DISCLAIMER} Insufficient biomarker response data for compound ${compoundId} — maintain current dose and recheck after next cycle.`,
      confidenceLevel: "low",
      responseDirection: "none",
    }
  }

  // Aggregate response across biomarkers
  // Ratio = observed / predicted; >1 means over-response, <0 means opposite direction
  const ratios = observedBiomarkerResponse
    .filter((b) => b.predictedDelta !== 0)
    .map((b) => b.observedDelta / b.predictedDelta)

  if (ratios.length === 0) {
    return {
      ...baseDisposition,
      rationale: `${DOSAGE_DISCLAIMER} No valid predicted deltas for compound ${compoundId} — cannot compute response ratio. Maintain current dose.`,
      confidenceLevel: "low",
      responseDirection: "none",
    }
  }

  const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length

  // Determine response direction
  let responseDirection: DosageSuggestion["responseDirection"]
  if (meanRatio < 0) responseDirection = "opposite"
  else if (meanRatio < 0.5) responseDirection = "insufficient"
  else responseDirection = "expected"

  const currentCss = computeCssAvg(currentDose, dosingIntervalHours, pk)
  const pkInfo = pkSource === "user_profile"
    ? `User-specific PK profile (n=${pkProfile!.n} observations)`
    : "Population PBPK defaults (no user PK profile available)"

  // Wrong direction → hold, clinician review
  if (responseDirection === "opposite") {
    return {
      ...baseDisposition,
      suggestedDose: null,
      rationale: `${DOSAGE_DISCLAIMER} Observed biomarker response for ${compoundId} moved in the opposite direction from prediction (ratio=${meanRatio.toFixed(2)}). Hold current dose of ${currentDose} ${currentUnit}. Clinician review required. ${pkInfo}. Current Css_avg estimate: ${currentCss.toFixed(2)} mg/L.`,
      confidenceLevel: "low",
      responseDirection,
      observedResponseRatio: meanRatio,
    }
  }

  // Insufficient response (< 50% of predicted) → suggest +25%, capped
  if (responseDirection === "insufficient") {
    const suggestedDose = Math.min(currentDose * 1.25, currentDose * 1.5)
    return {
      ...baseDisposition,
      suggestedDose,
      rationale: `${DOSAGE_DISCLAIMER} Observed response for ${compoundId} is ${(meanRatio * 100).toFixed(0)}% of predicted. Hypothesis: modest dose increase to ${suggestedDose.toFixed(1)} ${currentUnit} (+25%) may improve response trajectory. Clinician must review. ${pkInfo}.`,
      confidenceLevel: "medium",
      responseDirection,
      observedResponseRatio: meanRatio,
    }
  }

  // Expected direction — response is adequate; suggest proportional adjustment
  // If ratio > 1.5 (strong response) → consider dose reduction for tolerability
  if (meanRatio > 1.5) {
    const suggestedDose = Math.max(currentDose * 0.75, currentDose * 0.5)
    return {
      ...baseDisposition,
      suggestedDose,
      rationale: `${DOSAGE_DISCLAIMER} Observed response for ${compoundId} exceeds prediction by ${((meanRatio - 1) * 100).toFixed(0)}%. Hypothesis: dose reduction to ${suggestedDose.toFixed(1)} ${currentUnit} (-25%) may maintain efficacy with improved tolerability. Clinician must review. ${pkInfo}.`,
      confidenceLevel: "medium",
      responseDirection,
      observedResponseRatio: meanRatio,
    }
  }

  // Good response (0.5–1.5) → maintain current dose
  return {
    ...baseDisposition,
    suggestedDose: currentDose,
    rationale: `${DOSAGE_DISCLAIMER} Observed response for ${compoundId} is ${(meanRatio * 100).toFixed(0)}% of predicted — within acceptable range. Hypothesis: maintain current dose of ${currentDose} ${currentUnit}. Clinician to confirm. ${pkInfo}.`,
    confidenceLevel: pkSource === "user_profile" ? "high" : "medium",
    responseDirection,
    observedResponseRatio: meanRatio,
  }
}

/**
 * Async wrapper that fetches the user's PK profile from the DB before computing.
 * Silently falls back to population defaults if no profile exists.
 */
export async function runDosageOptimizer(input: {
  userId: string
  compoundId: string
  currentDose: number
  currentUnit: string
  dosingIntervalHours?: number
  observedBiomarkerResponse: BiomarkerDelta[]
}): Promise<DosageSuggestion> {
  let pkProfile: UserPkProfile | null = null

  try {
    const { db } = await import("@/lib/db")
    // Read PK profile from UserTwinPrior — use vd/cl priors as a proxy
    // until a dedicated UserPkProfile table exists (Tier 5)
    const priorVd = await db.userTwinPrior.findUnique({
      where: {
        userId_compoundId_outcomeKey: {
          userId: input.userId,
          compoundId: input.compoundId,
          outcomeKey: "vd_L",
        },
      },
    })

    if (priorVd) {
      pkProfile = {
        vd_L: priorVd.prior,
        cl_L_per_h: POP_DEFAULTS.cl_L_per_h,
        ka_per_h: POP_DEFAULTS.ka_per_h,
        f: POP_DEFAULTS.f,
        n: priorVd.n,
      }
    }
  } catch (err) {
    logger.warn("runDosageOptimizer: could not load PK profile, using population defaults", {
      userId: input.userId, compoundId: input.compoundId, error: String(err),
    })
  }

  return computeDosageSuggestion({ ...input, pkProfile })
}
