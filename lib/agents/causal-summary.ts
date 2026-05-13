/**
 * causal-summary — verifier-side helpers for CausalEffectEstimate VCs.
 *
 * The `/api/v1/credentials/verify` endpoint already surfaces a
 * `display_policy` + `display_ui` for digital-twin receipts so third-party
 * portals can render disclosure chrome in one round-trip. CausalEffectEstimate
 * VCs (issued by `runCausalInferenceAgent` when `signWith` is supplied) carry
 * a structurally different payload — exposure/outcome/effect/ci/cohort/model
 * — and benefit from the same one-shot summary so wallets don't have to dig
 * into the raw payload.
 *
 * `causalSummaryFromVc(vc)` returns a compact, typed object when the VC is a
 * CausalEffectEstimate and `null` otherwise. The summary is purely derived
 * from the embedded payload — there is no sidecar call.
 */

import type { VerifiableCredential } from "@/lib/sidecars"

export interface CausalSummary {
  intervention: string
  outcome: string
  expected_delta: number
  ci95: [number, number]
  cohort_source: string
  identification_strategy: string
  n_similar_profiles: number
  model_version: string
  /**
   * `low_evidence` is true when the bootstrap CI crosses zero (no clear
   * directional effect at the 95% level) OR the cohort is too small
   * (n < 50). Verifiers should de-emphasise such estimates.
   */
  low_evidence: boolean
  /**
   * Human-readable single-line effect description, e.g.
   * `"rapamycin → hs_crp: -0.18 (95% CI -0.31 to -0.05)"`. Suitable for
   * direct rendering as a wallet UI badge.
   */
  effect_label: string
  /**
   * Human-readable evidence qualifier, e.g.
   * `"Strong evidence (uk_biobank, n=1240)"` or
   * `"LOW EVIDENCE - CI crosses zero (uk_biobank, n=1240)"`. Mirrors the
   * twin display_ui banner ergonomics so verifier wallets render causal
   * estimates without re-deriving qualifiers.
   */
  evidence_label: string
}

function isCausalEffectEstimate(vc: VerifiableCredential): boolean {
  const t = (vc as { type?: unknown }).type
  if (Array.isArray(t)) return t.some((v) => String(v) === "CausalEffectEstimate")
  return typeof t === "string" && t === "CausalEffectEstimate"
}

function asPayload(vc: VerifiableCredential): Record<string, unknown> | null {
  const subj = (vc as { credentialSubject?: unknown }).credentialSubject
  if (!subj || typeof subj !== "object") return null
  const payload = (subj as { payload?: unknown }).payload
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null
}

function asCi95(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const [lo, hi] = value
  if (typeof lo !== "number" || typeof hi !== "number") return null
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null
  return [lo, hi]
}

export function causalSummaryFromVc(vc: VerifiableCredential): CausalSummary | null {
  if (!isCausalEffectEstimate(vc)) return null
  const payload = asPayload(vc)
  if (!payload) return null

  const ci95 = asCi95(payload.ci95)
  const expected = typeof payload.expected_delta === "number" ? payload.expected_delta : null
  if (ci95 === null || expected === null) return null

  const n = typeof payload.n_similar_profiles === "number" ? payload.n_similar_profiles : 0
  const ciCrossesZero = ci95[0] <= 0 && ci95[1] >= 0
  const low_evidence = ciCrossesZero || n < 50

  const intervention = String(payload.intervention ?? "")
  const outcome = String(payload.outcome ?? "")
  const cohort_source = String(payload.cohort_source ?? "")
  const identification_strategy = String(payload.identification_strategy ?? "")
  const model_version = String(payload.model_version ?? "")

  const effect_label = `${intervention} -> ${outcome}: ${expected.toFixed(3)} (95% CI ${ci95[0].toFixed(3)} to ${ci95[1].toFixed(3)})`
  const evidence_label = low_evidence
    ? `LOW EVIDENCE - ${ciCrossesZero ? "CI crosses zero" : `cohort too small (n=${n})`} (${cohort_source}, n=${n})`
    : `Strong evidence (${cohort_source}, n=${n})`

  return {
    intervention,
    outcome,
    expected_delta: expected,
    ci95,
    cohort_source,
    identification_strategy,
    n_similar_profiles: n,
    model_version,
    low_evidence,
    effect_label,
    evidence_label,
  }
}
