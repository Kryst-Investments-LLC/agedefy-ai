/**
 * twin-display-policy — single source of truth for how the UI should present
 * a digital-twin simulation result. The simulator can serve calibrated output
 * (mechanistic / statistical / hybrid backends) or, when the Python sidecar is
 * unavailable, a deterministic exponential-relaxation fallback. The UI MUST
 * NOT present fallback results as clinical-grade, so this helper turns the raw
 * `backend_used` tag plus per-outcome `low_confidence_flag`s into a single
 * `displayTier` that components, PDFs and the wallet renderer can switch on.
 *
 * Tiers:
 *   - "calibrated"        — mechanistic / statistical / hybrid, no low_confidence flags
 *   - "calibrated-partial" — calibrated backend, but ≥1 outcome flagged low_confidence
 *   - "illustrative"      — fallback-exponential backend (never clinical)
 *
 * The helper deliberately ignores trajectory magnitudes. Whether a delta is
 * "meaningful" is a clinician/jurisdiction decision, not a display decision.
 */

import type {
  MechanisticBackendUsed,
  OutcomeTrajectory,
  SimulateResponse,
} from "@/lib/sidecars"

export type TwinDisplayTier = "calibrated" | "calibrated-partial" | "illustrative"

export interface TwinDisplayPolicy {
  tier: TwinDisplayTier
  backendUsed: MechanisticBackendUsed
  /** True when results must not be presented as clinical guidance. */
  isIllustrative: boolean
  /** True when the UI should show a "do not act on this without a clinician" banner. */
  requiresClinicianBanner: boolean
  /** Outcome ids that carried a low_confidence_flag. */
  lowConfidenceOutcomes: string[]
  /** Human-readable badge label for use in UI chips. */
  badgeLabel: string
  /** One-line tooltip / aria-label explaining the badge. */
  badgeTooltip: string
}

const FALLBACK_BACKEND: MechanisticBackendUsed = "fallback-exponential"

/** Human-friendly label for each backend; used in badges, PDFs, and tooltips. */
const BACKEND_LABEL: Record<MechanisticBackendUsed, string> = {
  mechanistic: "mechanistic ODE",
  statistical: "statistical priors",
  hybrid: "hybrid (mechanistic + statistical)",
  "fallback-exponential": "in-process fallback",
}

function backendDescriptor(backendUsed: MechanisticBackendUsed): string {
  return BACKEND_LABEL[backendUsed] ?? String(backendUsed)
}

function lowConfidenceOutcomesOf(
  trajectories: Record<string, OutcomeTrajectory>,
): string[] {
  const out: string[] = []
  for (const [outcome, traj] of Object.entries(trajectories)) {
    if (traj.low_confidence_flag) out.push(outcome)
  }
  return out.sort()
}

/**
 * Compute the display policy for a SimulateResponse (or DigitalTwinAgentOutput,
 * which extends it). Safe to call on partially-built objects: missing fields
 * are treated as illustrative.
 */
export function getTwinDisplayPolicy(
  forecast: Pick<SimulateResponse, "backend_used" | "trajectories"> | null | undefined,
): TwinDisplayPolicy {
  const backendUsed: MechanisticBackendUsed =
    (forecast?.backend_used as MechanisticBackendUsed | undefined) ?? FALLBACK_BACKEND
  const trajectories = forecast?.trajectories ?? {}
  const lowConfidenceOutcomes = lowConfidenceOutcomesOf(trajectories)

  if (backendUsed === FALLBACK_BACKEND) {
    return {
      tier: "illustrative",
      backendUsed,
      isIllustrative: true,
      requiresClinicianBanner: true,
      lowConfidenceOutcomes,
      badgeLabel: "Illustrative — not clinical",
      badgeTooltip:
        "Trajectories were produced by the in-process fallback simulator because the mechanistic sidecar was unavailable. Do not present as a clinical forecast.",
    }
  }

  if (lowConfidenceOutcomes.length > 0) {
    return {
      tier: "calibrated-partial",
      backendUsed,
      isIllustrative: false,
      requiresClinicianBanner: true,
      lowConfidenceOutcomes,
      badgeLabel: `Calibrated (${backendDescriptor(backendUsed)}) — ${lowConfidenceOutcomes.length} outcome${
        lowConfidenceOutcomes.length === 1 ? "" : "s"
      } low-confidence`,
      badgeTooltip: `Backend: ${backendUsed}. Some outcomes were flagged low-confidence (missing baseline or unknown intervention-outcome pair): ${lowConfidenceOutcomes.join(", ")}.`,
    }
  }

  return {
    tier: "calibrated",
    backendUsed,
    isIllustrative: false,
    requiresClinicianBanner: false,
    lowConfidenceOutcomes: [],
    badgeLabel: `Calibrated (${backendDescriptor(backendUsed)})`,
    badgeTooltip: `Backend: ${backendUsed}. All requested outcomes have full-confidence trajectories.`,
  }
}

/**
 * Synthesise a TwinDisplayPolicy from a bare `backend_used` tag plus an
 * optional list of outcome ids flagged low-confidence — for code paths
 * (compare-stacks, PDF export route) that don't have a full SimulateResponse
 * in hand but still need the same labels.
 */
export function synthesiseDisplayPolicy(
  backendUsed: MechanisticBackendUsed,
  lowConfidenceOutcomes: string[] = [],
): TwinDisplayPolicy {
  const sorted = [...lowConfidenceOutcomes].sort()
  if (backendUsed === FALLBACK_BACKEND) {
    return {
      tier: "illustrative",
      backendUsed,
      isIllustrative: true,
      requiresClinicianBanner: true,
      lowConfidenceOutcomes: sorted,
      badgeLabel: "Illustrative — not clinical",
      badgeTooltip:
        "Trajectories were produced by the in-process fallback simulator because the mechanistic sidecar was unavailable. Do not present as a clinical forecast.",
    }
  }
  if (sorted.length > 0) {
    return {
      tier: "calibrated-partial",
      backendUsed,
      isIllustrative: false,
      requiresClinicianBanner: true,
      lowConfidenceOutcomes: sorted,
      badgeLabel: `Calibrated (${backendDescriptor(backendUsed)}) — ${sorted.length} outcome${
        sorted.length === 1 ? "" : "s"
      } low-confidence`,
      badgeTooltip: `Backend: ${backendUsed}. Some outcomes were flagged low-confidence: ${sorted.join(", ")}.`,
    }
  }
  return {
    tier: "calibrated",
    backendUsed,
    isIllustrative: false,
    requiresClinicianBanner: false,
    lowConfidenceOutcomes: [],
    badgeLabel: `Calibrated (${backendDescriptor(backendUsed)})`,
    badgeTooltip: `Backend: ${backendUsed}. Full-confidence trajectories.`,
  }
}

/** Convenience predicate for routes that must refuse to issue clinical VCs. */
export function isClinicalGrade(
  forecast: Pick<SimulateResponse, "backend_used" | "trajectories"> | null | undefined,
): boolean {
  return getTwinDisplayPolicy(forecast).tier === "calibrated"
}
