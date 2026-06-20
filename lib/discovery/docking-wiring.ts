/**
 * Pure wiring between the docking UI and POST /api/agents/chemistry/dock.
 *
 * Extracted from the React component so the request shape, base64 handling,
 * response decoding, and error branches can be unit/integration tested without
 * a WebGL context. The component just renders the result of `runDock`.
 */

export interface DockParams {
  /** Receptor as raw PDBQT text OR an already-base64 PDBQT blob. */
  receptor: string
  /** Ligand SMILES. */
  smiles: string
  center: { x: number; y: number; z: number }
  size: { x: number; y: number; z: number }
  exhaustiveness: number
  nPoses: number
}

export interface DockRenderState {
  /** Raw receptor PDBQT text for the viewer. */
  receptorText: string
  /** Decoded best-pose PDBQT text for the viewer. */
  ligandText: string
  affinity: number
  poseScores: number[]
}

export interface DockOutcome {
  ok: boolean
  render?: DockRenderState
  error?: string
}

export const DOCK_ENDPOINT = "/api/agents/chemistry/dock"

export const SIDECAR_DISABLED_MESSAGE =
  "Live docking is unavailable: the screening sidecar is not enabled (ENABLE_SCREENING_SIDECAR). " +
  "Use the PDB Explorer to inspect existing structures, or enable the sidecar to run AutoDock Vina."

/** Heuristic: text that looks like raw PDBQT (vs. an already-base64 blob). */
export function looksLikeRawPdbqt(s: string): boolean {
  return /\b(ATOM|HETATM|ROOT|BRANCH|REMARK)\b/.test(s)
}

/** Normalize a receptor input into { base64 (for the API), rawText (for the viewer) }. */
export function encodeReceptor(input: string): { base64: string; rawText: string } {
  const raw = input.trim()
  if (looksLikeRawPdbqt(raw)) {
    return { base64: btoa(raw), rawText: raw }
  }
  // Assume already base64; decode for the viewer (best-effort).
  let rawText = raw
  try {
    rawText = atob(raw)
  } catch {
    /* leave as-is */
  }
  return { base64: raw, rawText }
}

/** Build the JSON body for the dock endpoint. */
export function buildDockBody(params: DockParams, receptorBase64: string) {
  return {
    smiles: params.smiles.trim(),
    receptor_pdbqt: receptorBase64,
    box: { center: params.center, size: params.size },
    exhaustiveness: params.exhaustiveness,
    n_poses: params.nPoses,
  }
}

/** Decode a base64 PDBQT pose; falls back to the raw string if not base64. */
export function decodePose(best_pose_pdbqt: string): string {
  try {
    return atob(best_pose_pdbqt)
  } catch {
    return best_pose_pdbqt
  }
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number; ok: boolean; json: () => Promise<unknown> }>

/**
 * Run a docking request through the API. `fetchImpl` is injectable so the wiring
 * can be tested against a mocked endpoint. Never throws for HTTP errors —
 * returns a friendly `{ ok: false, error }` instead.
 */
export async function runDock(fetchImpl: FetchLike, params: DockParams): Promise<DockOutcome> {
  if (!params.receptor.trim() || !params.smiles.trim()) {
    return { ok: false, error: "Provide both a receptor (PDBQT) and a ligand SMILES." }
  }

  const { base64, rawText } = encodeReceptor(params.receptor)

  let res: Awaited<ReturnType<FetchLike>>
  try {
    res = await fetchImpl(DOCK_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildDockBody(params, base64)),
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Docking request failed." }
  }

  if (res.status === 404) return { ok: false, error: SIDECAR_DISABLED_MESSAGE }
  if (res.status === 401) return { ok: false, error: "Your session expired — please sign in again." }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: body.error ?? `Docking failed (HTTP ${res.status}).` }
  }

  const result = (await res.json()) as {
    best_pose_pdbqt: string
    binding_affinity_kcal_mol: number
    pose_scores_kcal_mol?: number[]
  }

  return {
    ok: true,
    render: {
      receptorText: rawText,
      ligandText: decodePose(result.best_pose_pdbqt),
      affinity: result.binding_affinity_kcal_mol,
      poseScores: result.pose_scores_kcal_mol ?? [],
    },
  }
}
