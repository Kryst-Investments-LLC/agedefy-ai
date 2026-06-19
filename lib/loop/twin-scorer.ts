import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export interface TwinAccuracyScore {
  simulationId: string
  userId: string
  endpoint: string
  /** null when not enough observations exist in the prediction window */
  accuracyRatio: number | null
  /** Whether the predicted direction (up/down) was correct */
  directionCorrect: boolean | null
  /** Whether observed value fell within the ±20% band around predictedMean */
  magnitudeWithin20Pct: boolean | null
  observationCount: number
  status: "scored" | "not_enough_data" | "error"
}

/**
 * Endpoint-to-biomarker-name mapping.
 * Sim endpoints use snake_case; biomarker names vary. We do a
 * case-insensitive substring match so "hs_crp" matches "hs-CRP".
 */
const ENDPOINT_TO_BIOMARKER: Record<string, string[]> = {
  hs_crp: ["hs-crp", "crp", "c-reactive protein"],
  hba1c: ["hba1c", "hemoglobin a1c", "glycated hemoglobin"],
  glucose: ["glucose", "fasting glucose"],
  ldl: ["ldl", "ldl cholesterol", "low-density lipoprotein"],
  apob: ["apob", "apolipoprotein b"],
  igf_1: ["igf-1", "igf1", "insulin-like growth factor"],
  grimage_delta: ["biological age", "grimage", "methylation age"],
  cystatin_c: ["cystatin c", "cystatin-c"],
  triglycerides: ["triglycerides"],
  nad_plus: ["nad+", "nad", "nicotinamide adenine dinucleotide"],
}

function endpointToBiomarkerNames(endpoint: string): string[] {
  const key = endpoint.toLowerCase().replace(/-/g, "_")
  return ENDPOINT_TO_BIOMARKER[key] ?? [endpoint.replace(/_/g, " ")]
}

/**
 * Scores a `TwinSimulationRun` against actual biomarker observations
 * collected within the simulation's `horizonDays` window.
 *
 * Returns `status: "not_enough_data"` when fewer than 1 observation is
 * available — the caller can retry later.
 *
 * Never throws.
 */
export async function scoreTwinPrediction(simulationId: string): Promise<TwinAccuracyScore> {
  try {
    const sim = await db.twinSimulationRun.findUnique({
      where: { id: simulationId },
      select: {
        id: true,
        userId: true,
        endpoint: true,
        predictedMean: true,
        horizonDays: true,
        createdAt: true,
      },
    })

    if (!sim) {
      return {
        simulationId,
        userId: "",
        endpoint: "",
        accuracyRatio: null,
        directionCorrect: null,
        magnitudeWithin20Pct: null,
        observationCount: 0,
        status: "error",
      }
    }

    const windowEnd = new Date(sim.createdAt.getTime() + sim.horizonDays * 24 * 60 * 60 * 1000)
    const biomarkerNames = endpointToBiomarkerNames(sim.endpoint)

    // Find actual observations in the prediction window
    const observations = await db.biomarker.findMany({
      where: {
        userId: sim.userId,
        measuredAt: { gte: sim.createdAt, lte: windowEnd },
        name: {
          in: biomarkerNames,
          mode: "insensitive",
        },
      },
      orderBy: { measuredAt: "asc" },
      select: { value: true, measuredAt: true },
    })

    if (observations.length === 0) {
      return {
        simulationId,
        userId: sim.userId,
        endpoint: sim.endpoint,
        accuracyRatio: null,
        directionCorrect: null,
        magnitudeWithin20Pct: null,
        observationCount: 0,
        status: "not_enough_data",
      }
    }

    // Baseline: last reading before the sim
    const baseline = await db.biomarker.findFirst({
      where: {
        userId: sim.userId,
        measuredAt: { lt: sim.createdAt },
        name: { in: biomarkerNames, mode: "insensitive" },
      },
      orderBy: { measuredAt: "desc" },
      select: { value: true },
    })

    // Use mean of observations as the "observed" endpoint value
    const observedMean =
      observations.reduce((sum, o) => sum + o.value, 0) / observations.length

    const baselineValue = baseline?.value ?? observedMean
    const observedDelta = observedMean - baselineValue
    const predictedDelta = sim.predictedMean - baselineValue

    const directionCorrect =
      Math.abs(predictedDelta) < 0.001
        ? Math.abs(observedDelta) < 0.001 // both negligible → correct
        : Math.sign(predictedDelta) === Math.sign(observedDelta)

    const magnitudeWithin20Pct =
      Math.abs(predictedDelta) > 0
        ? Math.abs(observedDelta - predictedDelta) / Math.abs(predictedDelta) <= 0.2
        : Math.abs(observedDelta) <= 0.001

    // accuracyRatio: 0–1 (1 = perfect direction + magnitude)
    const directionScore = directionCorrect ? 0.5 : 0
    const magnitudeScore = magnitudeWithin20Pct ? 0.5 : 0
    const accuracyRatio = directionScore + magnitudeScore

    logger.info("Twin prediction scored", {
      simulationId,
      endpoint: sim.endpoint,
      accuracyRatio,
      directionCorrect,
      observationCount: observations.length,
    })

    return {
      simulationId,
      userId: sim.userId,
      endpoint: sim.endpoint,
      accuracyRatio,
      directionCorrect,
      magnitudeWithin20Pct,
      observationCount: observations.length,
      status: "scored",
    }
  } catch (err) {
    logger.error("scoreTwinPrediction failed", { simulationId, error: String(err) })
    return {
      simulationId,
      userId: "",
      endpoint: "",
      accuracyRatio: null,
      directionCorrect: null,
      magnitudeWithin20Pct: null,
      observationCount: 0,
      status: "error",
    }
  }
}
