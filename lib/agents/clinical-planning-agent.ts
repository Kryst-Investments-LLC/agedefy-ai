/**
 * Clinical Planning Agent — PLAN stage of the self-improving loop.
 *
 * RESEARCHER / CLINICIAN USE ONLY.
 * Not wired to any consumer surface. All output labeled:
 * "AI-generated research analysis — requires expert validation."
 *
 * Given a PhysiologicalSnapshot and recent reflection history, this agent
 * decides WHICH investigation agents to run and in WHAT ORDER for the
 * current cycle — replacing the fixed planner sequence with an adaptive one.
 *
 * Hard constraints:
 *   - Safety agent is ALWAYS included; it cannot be skipped.
 *   - Discovery agent (`lib/agents/discovery-agent.ts`) is a FORBIDDEN PATH.
 *   - No user personal data is used to rank compound suggestions.
 *   - Output rationale always carries the expert-validation framing.
 */

import { createHash } from "node:crypto"

import { getAIConfig } from "@/lib/config/ai-config"
import { logger } from "@/lib/logger"
import { recordCacheEviction, recordCacheHit, recordCacheMiss } from "@/lib/observability/cache-metrics"
import type { AgentClass } from "./types"

export const PLAN_DISCLAIMER =
  "AI-generated research analysis — requires expert validation before any clinical action."

// Known pathways → agent focus mapping
// Tells the planner which agents are most relevant for a given pathway
const PATHWAY_AGENT_MAP: Record<string, AgentClass[]> = {
  "NF-kB / Inflammation": ["perception", "protocol", "safety"],
  "Insulin Resistance / mTOR": ["perception", "protocol", "safety"],
  "AMPK / Mitochondrial": ["perception", "protocol", "safety"],
  "NAD+ / Sirtuin": ["perception", "protocol", "safety"],
  "Cellular Senescence": ["perception", "safety"],
  "HPA Axis / Cortisol": ["perception", "protocol", "safety"],
  "GH / IGF-1 Axis": ["perception", "safety"],
  "Thyroid": ["perception", "safety"],
  "Cardiovascular / Lipid": ["perception", "protocol", "safety"],
  "Renal Function": ["perception", "safety"],
  "Liver / Metabolic": ["perception", "safety"],
  "Sex Hormones": ["perception", "safety"],
  "Epigenetic Aging": ["perception", "protocol", "safety"],
}

const ALWAYS_LAST: AgentClass[] = ["safety", "explainability"]

export interface AgentSequenceStep {
  agentClass: AgentClass
  reason: string
  toolFocus?: string[]
}

export interface InvestigationPlan {
  priorityPathways: string[]
  agentSequence: AgentSequenceStep[]
  /** Agents from the default set that this plan intentionally skips. */
  skipAgents: AgentClass[]
  rationale: string
  confidence: "high" | "medium" | "low"
}

interface SnapshotInput {
  dysregulatedPathways: string[] | unknown
  activeProtocolId: string | null
  protocolWeeksActive: number | null
  biomarkersJson: Record<string, unknown> | unknown
}

interface ReflectionSummary {
  insights?: string[]
  twinAccuracyDelta?: number | null
}

// ---------------------------------------------------------------------------
// Deterministic planner (no LLM)
// ---------------------------------------------------------------------------

function buildDeterministicPlan(
  dysregulatedPathways: string[],
  hasActiveProtocol: boolean,
  recentAccuracyDelta: number | null,
): InvestigationPlan {
  const priorityPathways = dysregulatedPathways.slice(0, 5)

  // Collect agents from pathway map
  const agentSet = new Set<AgentClass>()
  agentSet.add("perception") // always first

  for (const pathway of priorityPathways) {
    for (const agentClass of PATHWAY_AGENT_MAP[pathway] ?? ["perception", "safety"]) {
      if (ALWAYS_LAST.includes(agentClass)) continue
      // Only include protocol agent when there is an active protocol
      if (agentClass === "protocol" && !hasActiveProtocol) continue
      agentSet.add(agentClass)
    }
  }

  // Explicit protocol agent addition when a protocol is active (handles pathways without it)
  if (hasActiveProtocol) agentSet.add("protocol")

  // Build sequence: pathway-derived agents, then safety, then explainability
  const sequenceAgents: AgentClass[] = [
    ...Array.from(agentSet).filter((a) => !ALWAYS_LAST.includes(a)),
    "safety",
    "explainability",
  ]

  const agentSequence: AgentSequenceStep[] = sequenceAgents.map((agentClass) => ({
    agentClass,
    reason: agentClass === "safety"
      ? "Safety check always required — contraindications and interactions"
      : agentClass === "explainability"
        ? "Generate clinician-readable summary of all findings"
        : agentClass === "perception"
          ? "Build physiological context from biomarkers"
          : agentClass === "protocol"
            ? "Evaluate active protocol against observed outcomes"
            : `Relevant to: ${priorityPathways.slice(0, 2).join(", ")}`,
  }))

  const defaultAgents: AgentClass[] = ["perception", "protocol", "safety", "explainability"]
  const skipAgents = defaultAgents.filter((a) => !sequenceAgents.includes(a))

  const lowAccuracy = recentAccuracyDelta !== null && recentAccuracyDelta < -0.1
  const confidence = priorityPathways.length === 0
    ? "low"
    : lowAccuracy
      ? "medium"
      : "high"

  const rationale = [
    PLAN_DISCLAIMER,
    priorityPathways.length > 0
      ? `Top dysregulated pathways this cycle: ${priorityPathways.join(", ")}.`
      : "No specific pathway dysregulation detected — running standard perception + safety sequence.",
    hasActiveProtocol
      ? "Active protocol detected — protocol agent included for outcome evaluation."
      : "No active protocol — protocol agent skipped.",
    recentAccuracyDelta !== null
      ? `Recent twin prediction accuracy delta: ${recentAccuracyDelta >= 0 ? "+" : ""}${(recentAccuracyDelta * 100).toFixed(0)}%.`
      : "",
  ].filter(Boolean).join(" ")

  return { priorityPathways, agentSequence, skipAgents, rationale, confidence }
}

// ---------------------------------------------------------------------------
// LLM enrichment (optional — fills in rationale when LLM is available)
// ---------------------------------------------------------------------------

const LLM_CACHE = new Map<string, string>()
const LLM_CACHE_NAME = "clinical_planning_llm"

async function enrichRationale(
  plan: InvestigationPlan,
  biomarkerCount: number,
  reflectionInsights: string[],
): Promise<string> {
  const config = getAIConfig()
  if (!config.providers.anthropic.enabled || !config.providers.anthropic.apiKey) {
    return plan.rationale
  }

  const cacheKey = createHash("sha256")
    .update(plan.priorityPathways.join("|") + "|" + plan.agentSequence.map((s) => s.agentClass).join("|"))
    .digest("hex")
    .slice(0, 16)

  const cached = LLM_CACHE.get(cacheKey)
  if (cached) {
    recordCacheHit(LLM_CACHE_NAME)
    return cached
  }
  recordCacheMiss(LLM_CACHE_NAME)

  const prompt = [
    "You are a biomedical research planning assistant. Generate a concise planning rationale (2-3 sentences).",
    "",
    `Priority pathways: ${plan.priorityPathways.join(", ") || "none"}`,
    `Agent sequence: ${plan.agentSequence.map((s) => s.agentClass).join(" → ")}`,
    `Biomarkers measured: ${biomarkerCount}`,
    reflectionInsights.length > 0
      ? `Recent insights: ${reflectionInsights.slice(0, 2).join("; ")}`
      : "",
    "",
    "State which agents will run and why, referencing the pathways. Be factual, not prescriptive.",
    "End with: 'Requires expert validation — not medical advice.'",
    "",
    "Respond with plain text only (no JSON, no bullets).",
  ].filter(Boolean).join("\n")

  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 15_000)

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.providers.anthropic.apiKey}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.providers.anthropic.model,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
        system: "You are a biomedical research analysis assistant. You never provide medical advice.",
      }),
      signal: controller.signal,
    })

    if (response.ok) {
      const data = (await response.json()) as { content?: { text?: string }[] }
      const text = data.content?.[0]?.text?.trim()
      if (text) {
        if (LLM_CACHE.size > 200) {
          recordCacheEviction(LLM_CACHE_NAME, LLM_CACHE.size) // clear-all eviction
          LLM_CACHE.clear()
        }
        LLM_CACHE.set(cacheKey, text)
        return text
      }
    }
  } catch {
    // LLM call failed — use deterministic rationale
  }

  return plan.rationale
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runClinicalPlanningAgent(
  snapshot: SnapshotInput,
  recentReflections: ReflectionSummary[],
): Promise<InvestigationPlan> {
  try {
    const dysregulatedPathways = Array.isArray(snapshot.dysregulatedPathways)
      ? (snapshot.dysregulatedPathways as string[])
      : []

    const hasActiveProtocol = !!snapshot.activeProtocolId
    const biomarkerCount = Object.keys(snapshot.biomarkersJson as Record<string, unknown> ?? {}).length

    const latestAccuracyDelta =
      recentReflections.length > 0
        ? (recentReflections[0].twinAccuracyDelta ?? null)
        : null

    const reflectionInsights = recentReflections
      .flatMap((r) => r.insights ?? [])
      .slice(0, 3)

    const plan = buildDeterministicPlan(
      dysregulatedPathways,
      hasActiveProtocol,
      latestAccuracyDelta,
    )

    plan.rationale = await enrichRationale(plan, biomarkerCount, reflectionInsights)

    logger.info("InvestigationPlan created", {
      priorityPathways: plan.priorityPathways,
      agents: plan.agentSequence.map((s) => s.agentClass),
      confidence: plan.confidence,
    })

    return plan
  } catch (err) {
    logger.error("runClinicalPlanningAgent failed", { error: String(err) })
    // Minimal safe fallback — always run safety
    return {
      priorityPathways: [],
      agentSequence: [
        { agentClass: "perception", reason: "Fallback: gather context" },
        { agentClass: "safety", reason: "Fallback: safety always required" },
        { agentClass: "explainability", reason: "Fallback: summarize" },
      ],
      skipAgents: ["protocol"],
      rationale: `${PLAN_DISCLAIMER} Fallback plan used due to planning error.`,
      confidence: "low",
    }
  }
}
