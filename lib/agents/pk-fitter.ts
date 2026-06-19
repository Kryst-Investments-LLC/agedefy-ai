/**
 * PK Parameter Fitter — Tier 5.1
 *
 * Fits a per-user 1-compartment pharmacokinetic model to observed biomarker
 * response data from completed ProtocolOutcome records.
 *
 * Algorithm:
 *   - Collects ≥ 2 ProtocolOutcome records for the user × compound pair
 *   - Extracts observed biomarker deltas as a proxy for drug exposure
 *   - Fits 1-cmt model (Vd, CL, ka) using iterative least-squares
 *   - Stores fitted parameters in UserPkProfile
 *   - Falls back gracefully to population defaults when data is insufficient
 *
 * RESEARCHER / CLINICIAN role only. Not a medical prescription.
 */

import { logger } from "@/lib/logger"

// Population defaults — mirrors pbpk-1cmt.ts DEFAULTS
export const PK_POPULATION_DEFAULTS = {
  vd:   50,    // L
  cl:   5,     // L/h
  ka:   1.0,   // h⁻¹
  f:    0.7,   // oral bioavailability
}

const MIN_OUTCOMES_REQUIRED = 2

export interface FittedPkProfile {
  userId: string
  compoundId: string
  vd: number
  cl: number
  ka: number
  f: number
  n: number
  rmse: number
  fittedAt: string
  fittedFromOutcomeIds: string[]
  source: "fitted" | "population_default"
}

interface ObservedDataPoint {
  time_h: number        // midpoint observation time in hours (cycle centre)
  concentration_proxy: number  // |observedDelta| as AUC proxy
}

/**
 * Simple gradient-free 1-cmt least-squares fit.
 *
 * The 1-cmt concentration model (oral, bolus absorption):
 *   C(t) = (F * dose / Vd) * (ka / (ka - ke)) * (e^(-ke*t) - e^(-ka*t))
 * where ke = CL / Vd.
 *
 * Because we don't have absolute dose/concentration data (only biomarker deltas),
 * we use a proportional model: treat |observedDelta| as C(t_midpoint).
 * This is a relative fit — the parameters capture the shape of the curve,
 * not absolute concentrations.
 *
 * We grid-search over plausible (Vd, CL, ka) parameter space:
 *   Vd:  10–200 L   (step 10)
 *   CL:  0.5–30 L/h (step 0.5)
 *   ka:  0.1–5 h⁻¹  (step 0.1)
 */
function fitOneCompartment(
  observations: ObservedDataPoint[],
  doseProxy: number = 1.0,
  f: number = 0.7,
): { vd: number; cl: number; ka: number; rmse: number } {
  let bestVd  = PK_POPULATION_DEFAULTS.vd
  let bestCl  = PK_POPULATION_DEFAULTS.cl
  let bestKa  = PK_POPULATION_DEFAULTS.ka
  let bestRmse = Infinity

  const VD_VALS = [10, 20, 30, 50, 70, 100, 150, 200]
  const CL_VALS = [0.5, 1, 2, 3, 5, 8, 12, 20, 30]
  const KA_VALS = [0.1, 0.3, 0.5, 1.0, 1.5, 2.0, 5.0]

  for (const vd of VD_VALS) {
    for (const cl of CL_VALS) {
      const ke = cl / vd
      for (const ka of KA_VALS) {
        if (Math.abs(ka - ke) < 1e-6) continue // flip point

        let sse = 0
        for (const obs of observations) {
          const t = obs.time_h
          const predicted = (f * doseProxy / vd) * (ka / (ka - ke)) *
            (Math.exp(-ke * t) - Math.exp(-ka * t))
          const err = Math.abs(predicted) - obs.concentration_proxy
          sse += err * err
        }

        const rmse = Math.sqrt(sse / observations.length)
        if (rmse < bestRmse) {
          bestRmse = rmse
          bestVd   = vd
          bestCl   = cl
          bestKa   = ka
        }
      }
    }
  }

  return { vd: bestVd, cl: bestCl, ka: bestKa, rmse: bestRmse }
}

/**
 * Build observation points from ProtocolOutcome records.
 * Uses cycle midpoint (cycleLength/2 * 24 h) as t, and mean |delta| as proxy.
 */
function outcomesToObservations(
  outcomes: Array<{
    id: string
    observedBiomarkers: unknown
    cycleStartDate?: Date | null
    cycleEndDate?: Date | null
  }>,
): { points: ObservedDataPoint[]; outcomeIds: string[] } {
  const points: ObservedDataPoint[] = []
  const outcomeIds: string[] = []

  for (const outcome of outcomes) {
    const observed = Array.isArray(outcome.observedBiomarkers)
      ? (outcome.observedBiomarkers as Array<{ observedDelta: number }>)
      : []

    if (observed.length === 0) continue

    const meanAbsDelta =
      observed.reduce((s, b) => s + Math.abs(b.observedDelta), 0) / observed.length

    // Use cycle midpoint as observation time; default 14 days (336 h) if dates missing
    const cycleLengthDays =
      outcome.cycleStartDate && outcome.cycleEndDate
        ? Math.max(
            1,
            Math.round(
              (outcome.cycleEndDate.getTime() - outcome.cycleStartDate.getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 28

    const time_h = (cycleLengthDays / 2) * 24

    points.push({ time_h, concentration_proxy: meanAbsDelta })
    outcomeIds.push(outcome.id)
  }

  return { points, outcomeIds }
}

/**
 * Fit per-user PK parameters from ProtocolOutcome records.
 * Writes the result to UserPkProfile (upsert).
 * Returns null when insufficient data (< 2 qualifying outcomes).
 */
export async function fitPkProfile(
  userId: string,
  compoundId: string,
  tenantId = "default",
): Promise<FittedPkProfile | null> {
  try {
    const { db } = await import("@/lib/db")

    // Load the user's completed outcomes. NOTE: the current schema has no
    // compound linkage on Protocol/ProtocolOutcome, so we cannot filter
    // outcomes by compound here; compoundId scopes only the stored
    // UserPkProfile (keyed by userId + compoundId). Per-compound outcome
    // filtering needs a Protocol→compound relation first.
    const outcomes = await db.protocolOutcome.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        observedBiomarkers: true,
        cycleStartDate: true,
        cycleEndDate: true,
      },
      orderBy: { reflectedAt: "asc" },
    })

    if (outcomes.length < MIN_OUTCOMES_REQUIRED) {
      logger.info("fitPkProfile: insufficient outcomes, returning null", {
        userId, compoundId, found: outcomes.length, required: MIN_OUTCOMES_REQUIRED,
      })
      return null
    }

    const { points, outcomeIds } = outcomesToObservations(outcomes)

    if (points.length < MIN_OUTCOMES_REQUIRED) {
      logger.info("fitPkProfile: insufficient valid observation points", {
        userId, compoundId, points: points.length,
      })
      return null
    }

    const fitted = fitOneCompartment(points)

    // Upsert into UserPkProfile
    const profile = await db.userPkProfile.upsert({
      where: { userId_compoundId: { userId, compoundId } },
      create: {
        userId,
        compoundId,
        tenantId,
        vd: fitted.vd,
        cl: fitted.cl,
        ka: fitted.ka,
        f: PK_POPULATION_DEFAULTS.f,
        n: outcomeIds.length,
        rmse: fitted.rmse,
        fittedFromOutcomeIds: outcomeIds,
        fittedAt: new Date(),
      },
      update: {
        vd: fitted.vd,
        cl: fitted.cl,
        ka: fitted.ka,
        n: outcomeIds.length,
        rmse: fitted.rmse,
        fittedFromOutcomeIds: outcomeIds,
        fittedAt: new Date(),
      },
    })

    logger.info("fitPkProfile: profile fitted", {
      userId, compoundId, vd: fitted.vd, cl: fitted.cl, ka: fitted.ka,
      rmse: fitted.rmse.toFixed(4), n: outcomeIds.length,
    })

    return {
      userId: profile.userId,
      compoundId: profile.compoundId,
      vd: profile.vd,
      cl: profile.cl,
      ka: profile.ka,
      f: profile.f,
      n: profile.n,
      rmse: profile.rmse,
      fittedAt: profile.fittedAt.toISOString(),
      fittedFromOutcomeIds: Array.isArray(profile.fittedFromOutcomeIds)
        ? (profile.fittedFromOutcomeIds as string[])
        : [],
      source: "fitted",
    }
  } catch (err) {
    logger.error("fitPkProfile: failed", { userId, compoundId, error: String(err) })
    return null
  }
}

/**
 * Load a user's PK profile, returning population defaults if none fitted yet.
 */
export async function getPkProfile(
  userId: string,
  compoundId: string,
): Promise<FittedPkProfile> {
  try {
    const { db } = await import("@/lib/db")
    const profile = await db.userPkProfile.findUnique({
      where: { userId_compoundId: { userId, compoundId } },
    })

    if (profile) {
      return {
        userId: profile.userId,
        compoundId: profile.compoundId,
        vd: profile.vd,
        cl: profile.cl,
        ka: profile.ka,
        f: profile.f,
        n: profile.n,
        rmse: profile.rmse,
        fittedAt: profile.fittedAt.toISOString(),
        fittedFromOutcomeIds: Array.isArray(profile.fittedFromOutcomeIds)
          ? (profile.fittedFromOutcomeIds as string[])
          : [],
        source: "fitted",
      }
    }
  } catch (err) {
    logger.warn("getPkProfile: DB error, returning population default", {
      userId, compoundId, error: String(err),
    })
  }

  // Population default fallback
  return {
    userId,
    compoundId,
    ...PK_POPULATION_DEFAULTS,
    n: 0,
    rmse: 0,
    fittedAt: new Date(0).toISOString(),
    fittedFromOutcomeIds: [],
    source: "population_default",
  }
}
