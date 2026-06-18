/**
 * FEP cost-triage gate.
 *
 * Decides which candidates are worth the expense of a Schrödinger FEP+ run
 * (~$50–300 GPU-hours per edge) before committing GPU resources.  Uses three
 * cheap signals already present on every screened candidate:
 *
 *   1. Vina docking affinity  (50 % weight) — only strong binders improve with FEP
 *   2. Drug-likeness profile   (25 % weight) — PAINS / Lipinski / QED from RDKit screen
 *   3. Active-learning score   (25 % weight) — model's prior on this chemical space region
 *
 * Hard disqualifiers (recommend=false regardless of score):
 *   - No dock result: FEP requires a docked pose; run /v1/dock first
 *   - PAINS alert: structural flags that routinely give false positives in FEP
 *   - Invalid SMILES: sidecar already rejected the molecule
 *
 * This module is intentionally dependency-free (no DB, no HTTP) so it can be
 * unit-tested without any mocks.
 */

// Minimal shapes extracted from ScreenResult / DockResult in lib/sidecars.ts.
// Local interfaces keep this module free of sidecar HTTP client imports.

export interface ScreenSummary {
  valid: boolean
  /** Quantitative Estimate of Drug-likeness, 0–1. Null when descriptors unavailable. */
  qed: number | null
  /** Lipinski Ro5 filter result. Null when filters were not computed. */
  lipinski_pass: boolean | null
  /** True = no PAINS structural alerts (good). Null when filters not computed. */
  pains_pass: boolean | null
  /** hERG cardiac liability flag from ADMET prediction. */
  herg_risk: boolean | null
}

export interface DockSummary {
  /** AutoDock Vina binding affinity in kcal/mol. Negative = favourable binding. */
  binding_affinity_kcal_mol: number
}

export interface FepTriageInput {
  screen: ScreenSummary | null
  dock: DockSummary | null
  /** Active-learning acquisition score 0–1 from last feedback cycle. Null = no AL signal yet. */
  acquisitionScore: number | null
}

export interface FepTriageResult {
  /** Composite worthiness score 0–1. */
  score: number
  /** True when score ≥ 0.55 and all hard gates pass. */
  recommend: boolean
  /** Human-readable explanation of the decision. */
  reason: string
  /** Sub-scores exposed for transparency. */
  components: {
    affinityScore: number
    drugLikenessScore: number
    acquisitionContribution: number
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/**
 * Maps Vina binding affinity to a 0–1 score.
 * Calibrated so -5 kcal/mol → 0 (weak, FEP not useful) and -11 kcal/mol → 1
 * (strong hit, FEP will reliably rank analogues).  Linear interpolation in between.
 */
function affinityToScore(kcal: number): number {
  // affinity is negative; make it positive for arithmetic
  const magnitude = -kcal
  return clamp01((magnitude - 5) / 6)
}

/**
 * Derive a drug-likeness score from the RDKit screening summary.
 * Returns 0.5 (neutral) when screen data is absent.
 */
function drugLikenessScore(screen: ScreenSummary | null): number {
  if (!screen || !screen.valid) return 0

  const qedContrib = typeof screen.qed === "number" ? 0.4 * screen.qed : 0.2
  const lipinskiContrib = screen.lipinski_pass === true ? 0.3 : screen.lipinski_pass === false ? 0 : 0.15
  const painsContrib = screen.pains_pass === true ? 0.3 : screen.pains_pass === false ? 0 : 0.15

  return clamp01(qedContrib + lipinskiContrib + painsContrib)
}

export function computeFepGateScore(input: FepTriageInput): FepTriageResult {
  const { screen, dock, acquisitionScore } = input
  const reasons: string[] = []

  // ── Hard gates ──────────────────────────────────────────────────────────

  if (!dock) {
    return {
      score: 0,
      recommend: false,
      reason: "No docking result: run /api/agents/chemistry/dock before FEP triage.",
      components: { affinityScore: 0, drugLikenessScore: 0, acquisitionContribution: 0 },
    }
  }

  if (screen && screen.valid === false) {
    return {
      score: 0,
      recommend: false,
      reason: "Invalid SMILES: molecule failed sidecar sanitisation.",
      components: { affinityScore: 0, drugLikenessScore: 0, acquisitionContribution: 0 },
    }
  }

  if (screen?.pains_pass === false) {
    return {
      score: 0,
      recommend: false,
      reason: "PAINS structural alert detected: FEP results on PAINS compounds are unreliable.",
      components: { affinityScore: 0, drugLikenessScore: 0, acquisitionContribution: 0 },
    }
  }

  // ── Sub-scores ───────────────────────────────────────────────────────────

  const aScore = affinityToScore(dock.binding_affinity_kcal_mol)
  const dlScore = screen ? drugLikenessScore(screen) : 0.5  // neutral if no screen
  const alContrib = typeof acquisitionScore === "number" ? acquisitionScore : 0.5

  // ── Composite ────────────────────────────────────────────────────────────

  const composite = clamp01(0.5 * aScore + 0.25 * dlScore + 0.25 * alContrib)

  // ── Reason string ────────────────────────────────────────────────────────

  const affinityKcal = dock.binding_affinity_kcal_mol.toFixed(1)
  reasons.push(`Vina affinity ${affinityKcal} kcal/mol (affinity score ${(aScore * 100).toFixed(0)}%)`)

  if (screen) {
    const qedStr = typeof screen.qed === "number" ? screen.qed.toFixed(2) : "n/a"
    reasons.push(`QED ${qedStr}, Lipinski ${screen.lipinski_pass === true ? "pass" : screen.lipinski_pass === false ? "fail" : "unknown"}, PAINS clear`)
  } else {
    reasons.push("No screen data (drug-likeness scored neutral)")
  }

  reasons.push(`AL acquisition ${typeof acquisitionScore === "number" ? (acquisitionScore * 100).toFixed(0) + "%" : "none (neutral)"}`)

  const recommend = composite >= 0.55
  const verdict = recommend
    ? `Recommend FEP (composite ${(composite * 100).toFixed(0)}%).`
    : `Skip FEP (composite ${(composite * 100).toFixed(0)}% < 55% threshold).`

  return {
    score: composite,
    recommend,
    reason: `${verdict} ${reasons.join("; ")}.`,
    components: {
      affinityScore: aScore,
      drugLikenessScore: dlScore,
      acquisitionContribution: alContrib,
    },
  }
}
