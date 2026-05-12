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
  cohort: string
  exposure: string
  outcome: string
  covariates?: string[]
  estimator?: CausalEstimator
  n_bootstrap?: number
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
  refute: (req: { estimate_id: string }, traceparent?: string) =>
    request(causalSidecar.url(), "/v1/refute", {
      method: "POST",
      body: JSON.stringify(req),
      traceparent,
      timeoutMs: 60_000,
    }),
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
}

export interface CompareStacksResponse {
  simulation_id_a: string
  simulation_id_b: string
  delta_of_deltas: Record<
    string,
    { stack_a_final: number; stack_b_final: number; difference: number; ci95: [number, number] }
  >
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

export { SidecarError, envOrThrow }
