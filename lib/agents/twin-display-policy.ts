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

/**
 * Mechanistic-sidecar PK/PD model profile, derived from the response's
 * `model_version` tag. Lets callers (badges, PDFs, audit) distinguish 1-cmt
 * vs 2-cmt runs without re-parsing the version string everywhere. Always
 * `null` for non-mechanistic backends and for the in-process fallback.
 */
export type TwinPkpdProfile = "1-cmt" | "2-cmt" | null

export interface TwinDisplayPolicy {
  tier: TwinDisplayTier
  backendUsed: MechanisticBackendUsed
  /** True when results must not be presented as clinical guidance. */
  isIllustrative: boolean
  /** True when the UI should show a "do not act on this without a clinician" banner. */
  requiresClinicianBanner: boolean
  /** Outcome ids that carried a low_confidence_flag. */
  lowConfidenceOutcomes: string[]
  /** PK/PD model profile, when known and applicable (mechanistic backend only). */
  pkpdProfile: TwinPkpdProfile
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

/**
 * Detect the PK/PD profile from a mechanistic-sidecar `model_version`. The
 * 2-compartment backend (v0.4.0+) tags itself `mechanistic-sidecar-pkpd-2cmt@`;
 * everything else mechanistic is the original 1-compartment ODE.
 */
function pkpdProfileFor(
  backendUsed: MechanisticBackendUsed,
  modelVersion: string | undefined,
): TwinPkpdProfile {
  if (backendUsed !== "mechanistic") return null
  if (typeof modelVersion === "string" && modelVersion.includes("pkpd-2cmt")) {
    return "2-cmt"
  }
  return "1-cmt"
}

function pkpdSuffix(profile: TwinPkpdProfile): string {
  return profile === "2-cmt" ? " \u00b7 2-compartment PK/PD" : ""
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
  forecast:
    | Pick<SimulateResponse, "backend_used" | "trajectories" | "model_version">
    | null
    | undefined,
): TwinDisplayPolicy {
  const backendUsed: MechanisticBackendUsed =
    (forecast?.backend_used as MechanisticBackendUsed | undefined) ?? FALLBACK_BACKEND
  const trajectories = forecast?.trajectories ?? {}
  const lowConfidenceOutcomes = lowConfidenceOutcomesOf(trajectories)
  const pkpdProfile = pkpdProfileFor(backendUsed, forecast?.model_version)

  if (backendUsed === FALLBACK_BACKEND) {
    return {
      tier: "illustrative",
      backendUsed,
      isIllustrative: true,
      requiresClinicianBanner: true,
      lowConfidenceOutcomes,
      pkpdProfile: null,
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
      pkpdProfile,
      badgeLabel: `Calibrated (${backendDescriptor(backendUsed)}) — ${lowConfidenceOutcomes.length} outcome${
        lowConfidenceOutcomes.length === 1 ? "" : "s"
      } low-confidence${pkpdSuffix(pkpdProfile)}`,
      badgeTooltip: `Backend: ${backendUsed}. Some outcomes were flagged low-confidence (missing baseline or unknown intervention-outcome pair): ${lowConfidenceOutcomes.join(", ")}.`,
    }
  }

  return {
    tier: "calibrated",
    backendUsed,
    isIllustrative: false,
    requiresClinicianBanner: false,
    lowConfidenceOutcomes: [],
    pkpdProfile,
    badgeLabel: `Calibrated (${backendDescriptor(backendUsed)})${pkpdSuffix(pkpdProfile)}`,
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
  pkpdProfile: TwinPkpdProfile = null,
): TwinDisplayPolicy {
  const sorted = [...lowConfidenceOutcomes].sort()
  // Only the mechanistic backend has a meaningful PK/PD profile; coerce
  // anything else to null so callers don't accidentally label statistical or
  // hybrid runs with "2-compartment PK/PD".
  const profile: TwinPkpdProfile = backendUsed === "mechanistic" ? pkpdProfile : null
  if (backendUsed === FALLBACK_BACKEND) {
    return {
      tier: "illustrative",
      backendUsed,
      isIllustrative: true,
      requiresClinicianBanner: true,
      lowConfidenceOutcomes: sorted,
      pkpdProfile: null,
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
      pkpdProfile: profile,
      badgeLabel: `Calibrated (${backendDescriptor(backendUsed)}) — ${sorted.length} outcome${
        sorted.length === 1 ? "" : "s"
      } low-confidence${pkpdSuffix(profile)}`,
      badgeTooltip: `Backend: ${backendUsed}. Some outcomes were flagged low-confidence: ${sorted.join(", ")}.`,
    }
  }
  return {
    tier: "calibrated",
    backendUsed,
    isIllustrative: false,
    requiresClinicianBanner: false,
    lowConfidenceOutcomes: [],
    pkpdProfile: profile,
    badgeLabel: `Calibrated (${backendDescriptor(backendUsed)})${pkpdSuffix(profile)}`,
    badgeTooltip: `Backend: ${backendUsed}. Full-confidence trajectories.`,
  }
}

/** Convenience predicate for routes that must refuse to issue clinical VCs. */
export function isClinicalGrade(
  forecast: Pick<SimulateResponse, "backend_used" | "trajectories"> | null | undefined,
): boolean {
  return getTwinDisplayPolicy(forecast).tier === "calibrated"
}
