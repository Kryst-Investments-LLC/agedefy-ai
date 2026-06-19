/**
 * Scientific Reflection Agent — REFLECT stage of the self-improving loop.
 *
 * RESEARCHER / CLINICIAN USE ONLY.
 * Not wired to any consumer surface. Not medical advice. Not a protocol engine.
 * All output is labeled: "Retrospective research analysis — not medical advice."
 *
 * For each completed LoopCycle this agent:
 *   1. Reads the ProtocolOutcome (observed vs predicted biomarker deltas)
 *   2. Computes per-biomarker accuracy metrics (direction + magnitude)
 *   3. Asks an LLM to generate structured research insights
 *   4. Recommends prior adjustments for the digital twin fallback
 *   5. Persists a ReflectionReport and signs it with a W3C VC receipt
 *   6. Applies prior adjustments via twin-priors.ts
 *
 * The LLM is used only for natural-language insight generation. All numeric
 * computations (accuracy ratios, prior adjustments) are deterministic.
 */

import { db } from "@/lib/db"
import { getAIConfig } from "@/lib/config/ai-config"
import { logger } from "@/lib/logger"
import { signResultSafe } from "@/lib/provenance/sign-result"
import { updateEffectPrior, type PriorAdjustment } from "@/lib/agents/twin-priors"

export const REFLECTION_DISCLAIMER =
  "Retrospective research analysis — not medical advice. AI-generated insights require expert review before any clinical action."

export interface ReflectionInput {
  loopCycleId: string
  userId: string
  tenantId: string
}

export interface ReflectionOutput {
  reportId: string
  insights: string[]
  agentScoreDeltas: Record<string, number>
  twinAccuracyDelta: number | null
  priorAdjustments: PriorAdjustment[]
  disclaimer: string
  signedVc: unknown | null
}

interface ObservedBiomarker {
  name: string
  observedDelta: number
  observedDirection: "up" | "down" | "stable"
  confidence: number
}

interface TargetBiomarker {
  name: string
  predictedDelta: number
  predictedDirection: "up" | "down" | "stable"
}

// ---------------------------------------------------------------------------
// Accuracy metrics (deterministic)
// ---------------------------------------------------------------------------

function computeAccuracyMetrics(
  targets: TargetBiomarker[],
  observed: ObservedBiomarker[],
): { directionHits: number; total: number; priorAdjustments: PriorAdjustment[] } {
  if (targets.length === 0) return { directionHits: 0, total: 0, priorAdjustments: [] }

  const observedMap = new Map(observed.map((o) => [o.name.toLowerCase(), o]))
  let directionHits = 0
  const priorAdjustments: PriorAdjustment[] = []

  for (const target of targets) {
    const obs = observedMap.get(target.name.toLowerCase())
    if (!obs) continue

    const correct = target.predictedDirection === obs.observedDirection
    if (correct) directionHits++

    // Only recommend a prior adjustment when there's a meaningful observed delta
    if (Math.abs(obs.observedDelta) > 0.001) {
      priorAdjustments.push({
        compoundId: "unknown", // Filled in by caller who knows the active compound
        outcomeKey: target.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        observedDeltaPct: obs.observedDelta,
        recommendedPriorAdjustment: obs.observedDelta,
      })
    }
  }

  return { directionHits, total: targets.length, priorAdjustments }
}

// ---------------------------------------------------------------------------
// LLM insight generation
// ---------------------------------------------------------------------------

async function generateInsights(
  observed: ObservedBiomarker[],
  directionAccuracy: number,
): Promise<string[]> {
  const config = getAIConfig()
  if (!config.providers.anthropic.enabled || !config.providers.anthropic.apiKey) {
    return [
      `Observed ${observed.length} biomarker changes this cycle.`,
      `Prediction direction accuracy: ${(directionAccuracy * 100).toFixed(0)}%.`,
      "Insufficient AI provider configuration for detailed insight generation.",
    ]
  }

  const biomarkerSummary = observed
    .slice(0, 10) // limit prompt size
    .map((o) => `${o.name}: ${o.observedDelta > 0 ? "+" : ""}${o.observedDelta.toFixed(3)} (${o.observedDirection})`)
    .join("; ")

  const prompt = [
    "You are a biomedical research analysis system. Analyze the following retrospective biomarker changes from a longevity protocol cycle.",
    "",
    `Observed biomarker changes: ${biomarkerSummary || "none"}`,
    `Prediction direction accuracy this cycle: ${(directionAccuracy * 100).toFixed(0)}%`,
    "",
    "Generate exactly 3–5 concise research insights as a JSON array of strings.",
    "Each insight must:",
    "  - Be a factual observation or hypothesis about the data, not a recommendation",
    "  - Not mention specific doses, treatments, or patient-directed advice",
    "  - Be labeled as a research finding requiring expert validation",
    "",
    'Respond with ONLY a JSON array, e.g.: ["Insight 1.", "Insight 2."]',
    "",
    "IMPORTANT: This is retrospective research analysis only. Not medical advice.",
  ].join("\n")

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20_000)

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.providers.anthropic.apiKey}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.providers.anthropic.model,
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
        system:
          "You are a biomedical research analysis assistant. You generate structured research insights for expert scientists. You never provide medical advice, diagnoses, or treatment recommendations. All output is labeled as research analysis requiring expert validation.",
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      logger.warn("Reflection agent LLM call failed", { status: response.status })
      return fallbackInsights(observed, directionAccuracy)
    }

    const data = (await response.json()) as { content?: { text?: string }[] }
    const raw = data.content?.[0]?.text ?? "[]"

    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return fallbackInsights(observed, directionAccuracy)

    const parsed = JSON.parse(match[0]) as unknown[]
    if (!Array.isArray(parsed)) return fallbackInsights(observed, directionAccuracy)

    return parsed
      .filter((s): s is string => typeof s === "string")
      .slice(0, 5)
      .map((s) => `[Research Analysis] ${s}`)
  } catch {
    return fallbackInsights(observed, directionAccuracy)
  }
}

function fallbackInsights(observed: ObservedBiomarker[], directionAccuracy: number): string[] {
  const improving = observed.filter((o) => o.observedDirection !== "stable").length
  return [
    `[Research Analysis] ${observed.length} biomarker(s) measured this cycle; ${improving} showed directional change.`,
    `[Research Analysis] Prediction direction accuracy: ${(directionAccuracy * 100).toFixed(0)}% — requires expert review.`,
    "[Research Analysis] Retrospective research analysis only. Not medical advice. Requires expert validation before any clinical interpretation.",
  ]
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runReflectionAgent(
  input: ReflectionInput,
): Promise<ReflectionOutput | null> {
  try {
    const cycle = await db.loopCycle.findUnique({
      where: { id: input.loopCycleId },
      select: {
        id: true,
        userId: true,
        tenantId: true,
        status: true,
        protocolOutcome: {
          select: {
            id: true,
            targetBiomarkers: true,
            observedBiomarkers: true,
            twinPredictionAccuracy: true,
          },
        },
      },
    })

    if (!cycle) {
      logger.warn("runReflectionAgent: cycle not found", { loopCycleId: input.loopCycleId })
      return null
    }

    // Skip if a report already exists
    const existing = await db.reflectionReport.findUnique({
      where: { loopCycleId: input.loopCycleId },
      select: { id: true },
    })
    if (existing) {
      logger.info("Reflection report already exists", { loopCycleId: input.loopCycleId })
      return null
    }

    const outcome = cycle.protocolOutcome
    const targets = (outcome?.targetBiomarkers ?? []) as TargetBiomarker[]
    const observed = (outcome?.observedBiomarkers ?? []) as ObservedBiomarker[]

    const { directionHits, total, priorAdjustments } = computeAccuracyMetrics(targets, observed)
    const directionAccuracy = total > 0 ? directionHits / total : 0
    const twinAccuracyDelta = outcome?.twinPredictionAccuracy != null
      ? outcome.twinPredictionAccuracy - 0.5 // delta vs neutral baseline
      : null

    const insights = await generateInsights(observed, directionAccuracy)

    // W3C VC provenance receipt
    const signedVc = await signResultSafe({
      resultType: "ReflectionReport",
      result: {
        loopCycleId: input.loopCycleId,
        directionAccuracy,
        insightCount: insights.length,
        priorAdjustmentCount: priorAdjustments.length,
      },
      validationStatus: "ai_generated_hypothesis",
    })

    const report = await db.reflectionReport.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        loopCycleId: input.loopCycleId,
        protocolOutcomeId: outcome?.id ?? null,
        insights,
        agentScoreDeltas: {},
        twinAccuracyDelta,
        priorAdjustments,
        disclaimer: REFLECTION_DISCLAIMER,
        signedVc: signedVc ? (signedVc as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
      },
      select: { id: true },
    })

    // Apply prior adjustments (fire-and-forget per adjustment)
    for (const adj of priorAdjustments) {
      await updateEffectPrior(input.userId, adj)
    }

    logger.info("Reflection report created", {
      reportId: report.id,
      loopCycleId: input.loopCycleId,
      insights: insights.length,
      priorAdjustments: priorAdjustments.length,
    })

    return {
      reportId: report.id,
      insights,
      agentScoreDeltas: {},
      twinAccuracyDelta,
      priorAdjustments,
      disclaimer: REFLECTION_DISCLAIMER,
      signedVc,
    }
  } catch (err) {
    logger.error("runReflectionAgent failed", { loopCycleId: input.loopCycleId, error: String(err) })
    return null
  }
}
