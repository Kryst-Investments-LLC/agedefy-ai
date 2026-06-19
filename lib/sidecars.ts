/**
 * Typed HTTP clients for the three platform sidecars:
 *   - causal-sidecar  (DoWhy/EconML estimators)        CAUSAL_SIDECAR_URL
 *   - dp-accountant   (RDP epsilon ledger)             DP_ACCOUNTANT_URL
 *   - vc-signer       (W3C VCs, eddsa-jcs-2022)        VC_SIGNER_URL
 *
 * All requests propagate the W3C `traceparent` header when supplied so the
 * platform's distributed tracing covers sidecar hops.
 */

const DEFAULT_TIMEOUT_MS = 5000

class SidecarError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { traceparent?: string; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    }
    if (init.traceparent) headers.traceparent = init.traceparent
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    })
    const text = await res.text()
    const body = text ? safeJson(text) : null
    if (!res.ok) {
      throw new SidecarError(
        `sidecar ${baseUrl}${path} failed: ${res.status} ${res.statusText}`,
        res.status,
        body,
      )
    }
    return body as T
  } finally {
    clearTimeout(timer)
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function envOrThrow(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`environment variable ${name} is not set`)
  return v
}

// ---------- causal-sidecar ----------

export type CausalEstimator =
  | "backdoor.linear_regression"
  | "iv.instrumental_variable"
  | "dml.causal_forest"

export interface EstimateRequest {
  /** Per causal-sidecar contract v0.1.0: field is `cohort_source`, not `cohort`. */
  cohort_source: string
  exposure: string
  outcome: string
  covariates?: string[]
  estimator?: CausalEstimator
  n_bootstrap?: number
  /** SHA-256 of biomarker vector for cohort matching (no PII). */
  user_profile_hash?: string
}

export interface EstimateResponse {
  estimate_id: string
  expected_delta: number
  ci95: [number, number]
  n_similar_profiles: number
  identification_strategy: string
  sensitivity_report: {
    pleiotropy_pvalue: number | null
    weak_instrument_f_stat: number | null
    collider_bias_flag: boolean
  }
  model_version: string
  dag_serialization: string
}

export const causalSidecar = {
  url: () => process.env.CAUSAL_SIDECAR_URL || "http://causal-sidecar:8080",
  health: (traceparent?: string) =>
    request<{ status: string; version: string }>(causalSidecar.url(), "/healthz", { traceparent }),
  estimate: (req: EstimateRequest, traceparent?: string) =>
    request<EstimateResponse>(causalSidecar.url(), "/v1/estimate", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
      timeoutMs: 30_000,
    }),
  refute: (req: RefuteRequest, traceparent?: string) =>
    request<RefuteResponse>(causalSidecar.url(), "/v1/refute", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
      timeoutMs: 60_000,
    }),
}

export type CausalRefuter =
  | "placebo_treatment"
  | "random_common_cause"
  | "data_subset_refuter"

export interface RefuteRequest {
  estimate_id: string
  refuter: CausalRefuter
}

export interface RefuteResponse {
  estimate_id: string
  refuter: CausalRefuter
  /** Refuted causal effect under the placebo / random-cause / subset perturbation. */
  refuted_estimate: number
  /** p-value of the refutation test; small p ⇒ original estimate is robust. */
  p_value: number | null
  /** True when the refutation passes (i.e. the original estimate survived). */
  passed: boolean
  notes?: string
}

// ---------- dp-accountant ----------

export interface DpMechanism {
  kind: "gaussian" | "laplace"
  sensitivity: number
  noise_multiplier: number
  sample_rate?: number
  steps?: number
}

export interface DpSpendRequest {
  user_id: string
  mechanism: DpMechanism
  delta?: number
  purpose: string
}

export interface DpSpendResponse {
  user_id: string
  epsilon_spent_now: number
  epsilon_spent_total: number
  epsilon_remaining: number
  epsilon_budget: number
  delta: number
  receipt_id: string
  purpose: string
}

export const dpAccountant = {
  url: () => process.env.DP_ACCOUNTANT_URL || "http://dp-accountant:8080",
  health: (traceparent?: string) =>
    request<{ status: string }>(dpAccountant.url(), "/healthz", { traceparent }),
  check: (user_id: string, epsilon_request: number, traceparent?: string) =>
    request<{ allowed: boolean; epsilon_remaining: number; epsilon_budget: number; epsilon_spent: number }>(
      dpAccountant.url(),
      "/v1/budget/check",
      {
        method: "POST",
        body: JSON.stringify({ user_id, epsilon_request, delta: 1e-7 }),
        traceparent,
      },
    ),
  spend: (req: DpSpendRequest, traceparent?: string) =>
    request<DpSpendResponse>(dpAccountant.url(), "/v1/budget/spend", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
    }),
}

// ---------- vc-signer ----------

export interface VcIssueRequest {
  credentialSubject: Record<string, unknown>
  type?: string[]
  id?: string
  issuanceDate?: string
  expirationDate?: string
}

export type VerifiableCredential = Record<string, unknown> & {
  id: string
  issuer: string
  proof: { proofValue: string; verificationMethod: string }
}

export const vcSigner = {
  url: () => process.env.VC_SIGNER_URL || "http://vc-signer:8080",
  health: (traceparent?: string) =>
    request<{ status: string; issuer: string }>(vcSigner.url(), "/healthz", { traceparent }),
  issue: (req: VcIssueRequest, traceparent?: string) =>
    request<VerifiableCredential>(vcSigner.url(), "/v1/issue", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
    }),
  verify: (vc: VerifiableCredential, traceparent?: string) =>
    request<{ valid: boolean; errors: string[] }>(vcSigner.url(), "/v1/verify", {
      method: "POST",
      body: JSON.stringify({ vc }),
      traceparent,
    }),
  revoke: (id: string, traceparent?: string) =>
    request<{ id: string; status: "revoked" }>(vcSigner.url(), "/v1/revoke", {
      method: "POST",
      body: JSON.stringify({ id }),
      traceparent,
    }),
  status: (id: string, traceparent?: string) =>
    request<{ id: string; revoked: boolean }>(
      vcSigner.url(),
      `/v1/status/${encodeURIComponent(id)}`,
      { traceparent },
    ),
  revocations: (traceparent?: string) =>
    request<{ revoked: string[] }>(vcSigner.url(), "/v1/revocations", { traceparent }),
}

// ---------- mechanistic-sidecar ----------

export type MechanisticBackend = "mechanistic" | "statistical" | "hybrid"
export type MechanisticBackendUsed =
  | MechanisticBackend
  | "fallback-exponential"

export interface SimInterventionInput {
  intervention_id: string
  dose: number
  dose_unit?: string
  schedule: "daily" | "weekly" | "biweekly" | "monthly" | "prn"
  start_week: number
  stop_week?: number
  adherence?: number
}

export interface SimulateRequest {
  baseline: Record<string, number>
  interventions: SimInterventionInput[]
  horizon_weeks: number
  outcomes: string[]
  backend?: MechanisticBackend
  random_seed?: number
  /**
   * Opt into the 2-compartment PK/PD backend (mechanistic-sidecar v0.4.0).
   * Honoured only by `backend: "mechanistic"` or `backend: "hybrid"`;
   * the statistical backend ignores the flag.
   */
  pkpd_two_compartment?: boolean
}

export interface OutcomeTrajectory {
  weekly_means: number[]
  ci95_low: number[]
  ci95_high: number[]
  contributors?: Record<string, number>
  low_confidence_flag?: boolean
}

export interface SimulateResponse {
  simulation_id: string
  horizon_weeks: number
  backend_used: MechanisticBackendUsed
  model_version: string
  trajectories: Record<string, OutcomeTrajectory>
  warnings?: string[]
}

export interface CompareStacksRequest {
  baseline: Record<string, number>
  stack_a: SimInterventionInput[]
  stack_b: SimInterventionInput[]
  horizon_weeks: number
  outcomes: string[]
  /** See SimulateRequest.pkpd_two_compartment (mechanistic-sidecar v0.4.0). */
  pkpd_two_compartment?: boolean
}

export interface CompareStacksResponse {
  simulation_id_a: string
  simulation_id_b: string
  delta_of_deltas: Record<
    string,
    { stack_a_final: number; stack_b_final: number; difference: number; ci95: [number, number] }
  >
  /**
   * Backend + model_version that actually ran. Both stacks share dispatch in
   * mechanistic-sidecar's compare_stacks(), so a single pair is returned
   * (taken from the first stack's SimulateResponse). Added in v0.5.0;
   * optional so older sidecar versions still parse cleanly.
   */
  backend_used?: MechanisticBackendUsed
  model_version?: string
  /**
   * Union of outcomes flagged low_confidence_flag=true in either stack's
   * individual SimulateResponse. Empty when both stacks are fully calibrated.
   * Added in mechanistic-sidecar v0.3.0; older sidecars omit the field.
   */
  low_confidence_outcomes?: string[]
}

export const mechanisticSidecar = {
  url: () => process.env.MECHANISTIC_SIDECAR_URL || "http://mechanistic-sidecar:8080",
  configured: () => Boolean(process.env.MECHANISTIC_SIDECAR_URL),
  health: (traceparent?: string) =>
    request<{ status: string; version: string }>(
      mechanisticSidecar.url(),
      "/healthz",
      { traceparent },
    ),
  simulate: (req: SimulateRequest, traceparent?: string) =>
    request<SimulateResponse>(mechanisticSidecar.url(), "/v1/simulate", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
      timeoutMs: 30_000,
    }),
  compareStacks: (req: CompareStacksRequest, traceparent?: string) =>
    request<CompareStacksResponse>(mechanisticSidecar.url(), "/v1/compare-stacks", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
      timeoutMs: 60_000,
    }),
}

// ---------- Tier 5.2: Calibrated sidecar extensions ----------

export interface UserPkParamsPayload {
  userId: string
  compoundId: string
  vd: number
  cl: number
  ka: number
  f: number
  n: number
  rmse: number
}

export interface CalibratedSimRequest extends SimulateRequest {
  /** Per-user fitted PK parameters — sent alongside the simulation request */
  userPkParams: UserPkParamsPayload
}

/**
 * Push a user's fitted PK profile to the mechanistic sidecar so it can use
 * personalised parameters in subsequent simulation calls.
 * No-ops gracefully when the sidecar is not configured.
 */
export async function sendUserPkProfile(
  userId: string,
  compoundId: string,
  profile: Omit<UserPkParamsPayload, "userId" | "compoundId">,
  traceparent?: string,
): Promise<void> {
  if (!mechanisticSidecar.configured()) return

  try {
    await request<{ ok: boolean }>(mechanisticSidecar.url(), "/v1/pk-profile", {
      method: "POST",
      body: JSON.stringify({ userId, compoundId, ...profile }),
      traceparent,
      timeoutMs: 10_000,
    })
  } catch {
    // Non-fatal: the sidecar will fall back to population parameters
  }
}

/**
 * Request a simulation with the user's fitted PK parameters injected.
 * Falls back to the standard in-process 1-cmt model when the sidecar is
 * unavailable — the caller must check `fallbackUsed` on the result.
 */
export async function requestCalibratedSimulation(
  params: CalibratedSimRequest,
  traceparent?: string,
): Promise<SimulateResponse> {
  if (!mechanisticSidecar.configured()) {
    throw new SidecarError("Mechanistic sidecar not configured — use in-process fallback")
  }

  return request<SimulateResponse>(mechanisticSidecar.url(), "/v1/simulate-calibrated", {
    method: "POST",
    body: JSON.stringify(params),
    traceparent,
    timeoutMs: 30_000,
  })
}

// ---------- screening-sidecar ----------

export interface ScreenRequest {
  smiles: string
  include_pains?: boolean
}

export interface ScreenDescriptors {
  molecular_weight: number
  exact_molecular_weight: number
  mol_log_p: number
  hbd: number
  hba: number
  tpsa: number
  rotatable_bonds: number
  aromatic_rings: number
  rings: number
  heavy_atom_count: number
  stereocenters: number
  frac_csp3: number
  qed: number
  sa_score: number | null
}

export interface ScreenFilterResult {
  pass: boolean
  details: Record<string, boolean>
  violations?: number
  alerts?: string[]
  checked?: boolean
}

export interface ScreenAdmetFlag {
  likely?: boolean
  flag?: boolean
  basis: string
}

export interface ScreenResult {
  smiles: string
  canonical_smiles: string | null
  inchi: string | null
  inchi_key: string | null
  valid: boolean
  sanitization_error: string | null
  descriptors: ScreenDescriptors | null
  filters: {
    lipinski: ScreenFilterResult
    veber: ScreenFilterResult
    ghose: ScreenFilterResult
    lead_like: ScreenFilterResult
    pains: ScreenFilterResult
  } | null
  admet_flags: {
    bbb_penetrant: ScreenAdmetFlag
    oral_absorption_risk: ScreenAdmetFlag
    pgp_substrate_risk: ScreenAdmetFlag
    herg_liability_risk: ScreenAdmetFlag
  } | null
  model_version: string
}

export interface BatchScreenRequest {
  smiles_list: string[]
  include_pains?: boolean
}

export interface BatchScreenResult {
  results: ScreenResult[]
}

export const screeningSidecar = {
  url: () => process.env.SCREENING_SIDECAR_URL ?? "http://screening-sidecar:8080",
  configured: () => Boolean(process.env.SCREENING_SIDECAR_URL),
  health: (traceparent?: string) =>
    request<{ status: string; version: string; rdkit_version: string }>(
      screeningSidecar.url(),
      "/healthz",
      { traceparent },
    ),
  screen: (req: ScreenRequest, traceparent?: string) =>
    request<ScreenResult>(screeningSidecar.url(), "/v1/screen", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
      timeoutMs: 10_000,
    }),
  screenBatch: (req: BatchScreenRequest, traceparent?: string) =>
    request<BatchScreenResult>(screeningSidecar.url(), "/v1/screen/batch", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
      timeoutMs: 30_000,
    }),
  dock: (req: DockRequest, traceparent?: string) =>
    request<DockResult>(screeningSidecar.url(), "/v1/dock", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
      timeoutMs: 300_000,
    }),
}

// ---------- screening-sidecar / docking types ----------

export interface DockingBox {
  center: { x: number; y: number; z: number }
  size: { x: number; y: number; z: number }
}

export interface DockRequest {
  smiles: string
  /** Base64-encoded PDBQT of the prepared receptor */
  receptor_pdbqt: string
  box: DockingBox
  /** 1–32, default 8 */
  exhaustiveness?: number
  /** 1–20, default 5 */
  n_poses?: number
}

export interface DockResult {
  ligand_smiles: string
  binding_affinity_kcal_mol: number
  pose_scores_kcal_mol: number[]
  best_pose_pdbqt: string
  n_poses_returned: number
  exhaustiveness: number
  model_version: string
}

// ---------- openmm-sidecar ----------

export interface OpenmmForceFieldConfig {
  protein?: "amber14-all" | "charmm36m"
  small_molecule?: "openff-2.0.0" | "openff-1.3.1" | "mmff94"
  water?: "tip3p" | "tip3pfb"
}

export interface OpenmmSimulationConfig {
  minimization_steps?: number
  equilibration_ps?: number
  production_ps?: number
  temperature_K?: number
  pressure_bar?: number
}

export interface MdRankingWeights {
  mmgbsa?: number
  rmsd_penalty?: number
}

export interface RefineRequest {
  smiles: string
  /** Base64-encoded PDB (preferred) or PDBQT receptor */
  receptor: string
  receptor_format?: "pdb" | "pdbqt"
  /** Base64-encoded PDBQT pose from /v1/dock */
  docked_pose_pdbqt: string
  force_field?: OpenmmForceFieldConfig
  simulation?: OpenmmSimulationConfig
  /** "minimize" (default) or "md" for full MD + MM-GBSA */
  refine_mode?: "minimize" | "md"
  compute_mmgbsa?: boolean
  /** Weights used to compute md_ranking_score; echoed in response */
  ranking_weights?: MdRankingWeights
}

export interface RefineResult {
  smiles: string
  refine_mode: "minimize" | "md"
  force_field_used: Required<OpenmmForceFieldConfig>
  receptor_format_received: "pdb" | "pdbqt"
  receptor_conversion_warning: string | null
  initial_potential_energy_kj_mol: number
  minimized_potential_energy_kj_mol: number
  pose_rmsd_angstrom: number | null
  mmgbsa_binding_energy_kcal_mol: number | null
  mmgbsa_std_kcal_mol: number | null
  convergence_flag: boolean
  n_trajectory_frames: number
  /** Base64-encoded PDB of the refined complex */
  refined_complex_pdb: string
  md_ranking_score: number | null
  weights_used: Required<MdRankingWeights>
  mmgbsa_accuracy_note: string | null
  model_version: string
}

export const openmmSidecar = {
  url: () => process.env.OPENMM_SIDECAR_URL ?? "http://openmm-sidecar:8080",
  configured: () => Boolean(process.env.OPENMM_SIDECAR_URL),
  health: (traceparent?: string) =>
    request<{ status: string; version: string; openmm_version: string | null; openmm_available: boolean }>(
      openmmSidecar.url(),
      "/healthz",
      { traceparent },
    ),
  refine: (req: RefineRequest, traceparent?: string) =>
    request<RefineResult>(openmmSidecar.url(), "/v1/refine", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
      timeoutMs: 1_800_000, // 30 min — MD mode can take this long
    }),
}

// ---------- fep-sidecar (Schrödinger FEP+ wrapper) ----------
//
// The sidecar owns all Schrödinger API communication, license token management,
// ligand/receptor preparation (LigPrep + Protein Preparation Wizard), job
// submission, polling, and result extraction.  We only define the HTTP contract
// between Next.js and the sidecar process.
//
// Perturbation mode is always "relative" (ΔΔG = G_candidate − G_reference).
// This is the standard FEP+ lead-optimisation workflow.

export type FepBackend = "schrodinger-fep+" | "openfe" | "perses"

export interface FepRequest {
  /** SMILES of the reference ligand (anchor of the perturbation). */
  smiles_reference: string
  /** SMILES of the candidate ligand being evaluated relative to the reference. */
  smiles_candidate: string
  /** Base64-encoded PDB receptor (all-atom prepared structure). */
  receptor_pdb: string
  /** Base64-encoded PDBQT of the best docked pose for smiles_candidate (from /v1/dock). */
  docked_pose_pdbqt: string
  /** Alchemical lambda windows per leg. FEP+ default is 12; range 8–24. */
  lambda_windows?: number
  /** MD sampling per lambda window in nanoseconds. FEP+ default is 5. */
  sampling_ns_per_window?: number
  /** Simulation temperature in Kelvin. Default 300 K. */
  temperature_K?: number
}

export interface FepResult {
  /** ΔΔG = ΔG_candidate − ΔG_reference (kcal/mol). Negative means candidate binds tighter. */
  ddg_kcal_mol: number
  /** Standard error of the mean on ddg_kcal_mol (kcal/mol). */
  ddg_sem_kcal_mol: number
  /** Absolute ΔG estimate for the candidate from FEP+ (kcal/mol). */
  dg_candidate_kcal_mol: number
  /** Absolute ΔG estimate for the reference from FEP+ (kcal/mol). */
  dg_reference_kcal_mol: number
  /** True when hysteresis < 1.0 kcal/mol (Schrödinger convergence criterion). */
  convergence_flag: boolean
  /** Cycle-closure hysteresis in kcal/mol. Null for single-edge perturbations. */
  hysteresis_kcal_mol: number | null
  lambda_windows_used: number
  sampling_ns_per_window: number
  backend_used: FepBackend
  /** Schrödinger internal job ID for provenance; null for open-source backends. */
  schrodinger_job_id: string | null
  model_version: string
}

export const fepSidecar = {
  url: () => process.env.FEP_SIDECAR_URL ?? "http://fep-sidecar:8080",
  configured: () => Boolean(process.env.FEP_SIDECAR_URL),
  health: (traceparent?: string) =>
    request<{ status: string; version: string; backend: FepBackend }>(
      fepSidecar.url(),
      "/healthz",
      { traceparent },
    ),
  perturb: (req: FepRequest, traceparent?: string) =>
    request<FepResult>(fepSidecar.url(), "/v1/perturb", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
      // A single relative FEP edge takes 30–90 min on GPU; cap at 2 h.
      timeoutMs: 7_200_000,
    }),
}

export { SidecarError, envOrThrow }
