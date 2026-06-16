import { z } from 'zod'

// ── Assay request (nested inside create) ─────────────────────────────────────

export const assayRequestSchema = z.object({
  assayName: z.string().trim().min(1).max(200),
  assayType: z.enum(['biochemical', 'cellular', 'animal', 'in_silico']).optional(),
  description: z.string().trim().max(2000).optional(),
  concentrationRangeUm: z
    .tuple([z.number().positive(), z.number().positive()])
    .refine(([lo, hi]) => lo < hi, 'concentrationRangeUm[0] must be less than [1]')
    .optional(),
  replicates: z.number().int().min(1).max(20).default(3),
  controls: z.array(z.string().trim().max(300)).max(10).optional(),
  protocolNote: z.string().trim().max(2000).optional(),
})

export type AssayRequest = z.infer<typeof assayRequestSchema>

// ── POST /api/experiment/candidates/[id]/lab-submissions ──────────────────────

export const createLabSubmissionSchema = z.object({
  labName: z.string().trim().min(1).max(300),
  labContact: z.string().trim().max(300).optional(),
  requestedAssays: z
    .array(assayRequestSchema)
    .min(1, 'At least one assay request is required')
    .max(20),
  deadlineAt: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type CreateLabSubmissionInput = z.infer<typeof createLabSubmissionSchema>

// ── PATCH /api/lab-submissions/[id] ──────────────────────────────────────────

const LAB_SUBMISSION_TERMINAL_STATUSES = ['COMPLETE', 'VOID'] as const

export const patchLabSubmissionSchema = z.object({
  status: z.enum(LAB_SUBMISSION_TERMINAL_STATUSES),
  notes: z.string().trim().max(2000).optional(),
})

export type PatchLabSubmissionInput = z.infer<typeof patchLabSubmissionSchema>

// ── POST /api/lab-submissions/ingest ─────────────────────────────────────────
// Token-authenticated; no user session.

export const ingestResultSchema = z.object({
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

export type IngestResult = z.infer<typeof ingestResultSchema>

export const labIngestSchema = z.object({
  token: z.string().min(1).max(200),
  results: z
    .array(ingestResultSchema)
    .min(1, 'At least one result is required')
    .max(50),
  // When true, the lab indicates these are the final results; marks submission COMPLETE.
  final: z.boolean().default(false),
})

export type LabIngestInput = z.infer<typeof labIngestSchema>

// ── GET /api/experiment/candidates/[id]/lab-submissions (query) ───────────────

const LAB_SUBMISSION_STATUSES = ['PENDING', 'PARTIAL', 'COMPLETE', 'VOID'] as const

export const listLabSubmissionsQuerySchema = z.object({
  status: z.enum(LAB_SUBMISSION_STATUSES).optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('20'),
})
