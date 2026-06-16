/**
 * Lab handoff package builder.
 *
 * Pure functions — no DB access — so they're fully unit-testable.
 * `buildLabPackage` assembles the immutable JSON snapshot that is stored
 * on LabSubmission.packageJson and sent to the external lab.
 * `generateSubmissionToken` produces a one-time 64-hex-char token; only
 * the SHA-256 hash is stored server-side.
 */

import { createHash, randomBytes } from 'node:crypto'

import type { AssayRequest } from '@/lib/validators/lab-submission'

// Minimal candidate shape the builder needs — matches ExperimentCandidate fields.
export interface LabPackageCandidate {
  id: string
  displayName: string
  kind: string
  smiles: string | null
  chemblId: string | null
  targetName: string | null
  targetChemblId: string | null
  hypothesisNote: string | null
  screenJson: unknown
  dockJson: unknown
}

export interface LabPackage {
  submission_ref: string           // LabSubmission.id, filled in post-create
  exported_at: string
  platform: string
  candidate: {
    id: string
    display_name: string
    kind: string
    smiles: string | null
    chembl_id: string | null
    target_name: string | null
    target_chembl_id: string | null
    hypothesis_note: string | null
    screening_summary: Record<string, unknown> | null
    docking_score_kcal_mol: number | null
  }
  assay_requests: AssayRequest[]
  deadline: string | null
  lab_name: string
  lab_contact: string | null
  ingest_endpoint: string
  ingest_schema: {
    description: string
    token: string
    results: string
    final: string
  }
}

export function buildLabPackage(opts: {
  submissionId: string
  candidate: LabPackageCandidate
  requestedAssays: AssayRequest[]
  labName: string
  labContact: string | null | undefined
  deadlineAt: string | null | undefined
  ingestBaseUrl: string
}): LabPackage {
  const screen = extractScreeningSummary(opts.candidate.screenJson)
  const dockingScore = extractDockingScore(opts.candidate.dockJson)

  return {
    submission_ref: opts.submissionId,
    exported_at: new Date().toISOString(),
    platform: 'Biozephyra ÆonForge',
    candidate: {
      id: opts.candidate.id,
      display_name: opts.candidate.displayName,
      kind: opts.candidate.kind,
      smiles: opts.candidate.smiles,
      chembl_id: opts.candidate.chemblId,
      target_name: opts.candidate.targetName,
      target_chembl_id: opts.candidate.targetChemblId,
      hypothesis_note: opts.candidate.hypothesisNote,
      screening_summary: screen,
      docking_score_kcal_mol: dockingScore,
    },
    assay_requests: opts.requestedAssays,
    deadline: opts.deadlineAt ?? null,
    lab_name: opts.labName,
    lab_contact: opts.labContact ?? null,
    ingest_endpoint: `POST ${opts.ingestBaseUrl}/api/lab-submissions/ingest`,
    ingest_schema: {
      description: 'POST JSON to ingest_endpoint to return results.',
      token: 'string — the submission_token provided separately',
      results: 'array of { assay_name, value, unit, operator?, flag?, assay_type?, lab?, measured_at (ISO 8601), raw_data_uri?, notes? }',
      final: 'boolean — set true when this is the last batch of results',
    },
  }
}

export function generateSubmissionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  return { token, tokenHash }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractScreeningSummary(screenJson: unknown): Record<string, unknown> | null {
  if (!screenJson || typeof screenJson !== 'object') return null
  const s = screenJson as Record<string, unknown>

  const descriptors = s.descriptors as Record<string, unknown> | null | undefined
  const filters = s.filters as Record<string, unknown> | null | undefined
  const admet = s.admet_flags as Record<string, unknown> | null | undefined

  return {
    valid: s.valid ?? null,
    model_version: s.model_version ?? null,
    qed: descriptors?.qed ?? null,
    mol_log_p: descriptors?.mol_log_p ?? null,
    molecular_weight: descriptors?.molecular_weight ?? null,
    lipinski_pass: (filters?.lipinski as Record<string, unknown> | null)?.pass ?? null,
    bbb_penetrant: (admet?.bbb_penetrant as Record<string, unknown> | null)?.likely ?? null,
    herg_liability: (admet?.herg_liability_risk as Record<string, unknown> | null)?.flag ?? null,
  }
}

function extractDockingScore(dockJson: unknown): number | null {
  if (!dockJson || typeof dockJson !== 'object') return null
  const d = dockJson as Record<string, unknown>
  const score = d.binding_affinity_kcal_mol
  return typeof score === 'number' ? score : null
}
