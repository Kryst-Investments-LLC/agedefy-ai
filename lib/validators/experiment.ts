import { z } from 'zod'
import type { ExperimentCandidateStatus } from '@prisma/client'

// ── Ordered lifecycle — only forward adjacent transitions allowed ──────────────

const LIFECYCLE_STATUSES = ['PROPOSED', 'SCREENED', 'SENT_TO_LAB', 'RESULT_LOGGED', 'FED_BACK'] as const
const CANDIDATE_KINDS = ['CHEMBL', 'AI'] as const

export const LIFECYCLE: ExperimentCandidateStatus[] =
  LIFECYCLE_STATUSES as unknown as ExperimentCandidateStatus[]

export function nextAllowedStatus(
  current: ExperimentCandidateStatus,
): ExperimentCandidateStatus | null {
  const idx = LIFECYCLE.indexOf(current)
  return idx >= 0 && idx < LIFECYCLE.length - 1 ? LIFECYCLE[idx + 1] : null
}

export function isValidTransition(
  from: ExperimentCandidateStatus,
  to: ExperimentCandidateStatus,
): boolean {
  return nextAllowedStatus(from) === to
}

// ── POST /api/experiment/candidates ──────────────────────────────────────────

export const createExperimentCandidateSchema = z.object({
  kind: z.enum(CANDIDATE_KINDS),
  displayName: z.string().trim().min(1).max(300),
  smiles: z.string().trim().max(4000).optional(),

  // ChEMBL fields
  chemblId: z
    .string()
    .trim()
    .regex(/^CHEMBL\d+$/, 'Must be a valid ChEMBL ID, e.g. CHEMBL413')
    .optional(),
  chemblScore: z.number().min(0).max(1).optional(),
  chemblJson: z.record(z.unknown()).optional(),

  // AI fields
  aeonForgeCandidateId: z.string().cuid().optional(),
  aiMolJson: z.record(z.unknown()).optional(),

  // Researcher context
  targetName: z.string().trim().max(300).optional(),
  targetChemblId: z
    .string()
    .trim()
    .regex(/^CHEMBL\d+$/)
    .optional(),
  hypothesisNote: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type CreateExperimentCandidateInput = z.infer<typeof createExperimentCandidateSchema>

// ── PATCH /api/experiment/candidates/[id]/transition ─────────────────────────

export const transitionCandidateSchema = z.object({
  toStatus: z.enum(LIFECYCLE_STATUSES),
  notes: z.string().trim().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type TransitionCandidateInput = z.infer<typeof transitionCandidateSchema>

// ── POST /api/experiment/candidates/[id]/lab-results ─────────────────────────

export const createLabResultSchema = z.object({
  assayName: z.string().trim().min(1).max(200),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(50),
  operator: z.enum(['=', '<', '>']).default('='),
  flag: z.enum(['active', 'inactive', 'borderline', 'toxic']).optional(),
  assayType: z.enum(['biochemical', 'cellular', 'animal', 'in_silico']).optional(),
  lab: z.string().trim().max(200).optional(),
  measuredAt: z.string().datetime(),
  rawDataUri: z.string().url().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type CreateLabResultInput = z.infer<typeof createLabResultSchema>

// ── GET /api/experiment/candidates (query params) ────────────────────────────

export const listCandidatesQuerySchema = z.object({
  status: z
    .string()
    .transform((s) => s.split(',').map((v) => v.trim()))
    .pipe(z.array(z.enum(LIFECYCLE_STATUSES)))
    .optional(),
  kind: z.enum(CANDIDATE_KINDS).optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('50'),
})
