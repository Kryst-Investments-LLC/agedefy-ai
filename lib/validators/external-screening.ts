import { z } from 'zod'

// ── CRUD: register / update an adapter ────────────────────────────────────────

export const createAdapterSchema = z.object({
  name: z.string().trim().min(1).max(200),
  endpointUrl: z.string().url('endpointUrl must be a valid URL').max(2000),
  authHeader: z.string().trim().min(1).max(100).default('Authorization'),
  authScheme: z.string().trim().min(1).max(50).default('Bearer'),
  secret: z.string().min(1).max(1000),
  timeoutMs: z.number().int().min(1000).max(300_000).default(15_000),
  enabled: z.boolean().default(true),
  notes: z.string().trim().max(2000).optional(),
})

export type CreateAdapterInput = z.infer<typeof createAdapterSchema>

export const updateAdapterSchema = createAdapterSchema.partial()

export type UpdateAdapterInput = z.infer<typeof updateAdapterSchema>

export const listAdaptersQuerySchema = z.object({
  enabled: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('50'),
})

// ── POST /api/screening-adapters/[id]/run ─────────────────────────────────────

export const runAdapterSchema = z.object({
  smiles: z.string().min(1).max(4000),
  candidateId: z.string().cuid().optional(),
  include_pains: z.boolean().optional(),
  // When provided, write the normalized result back to ExperimentCandidate.screenJson.
  writeBack: z.boolean().default(false),
})

export type RunAdapterInput = z.infer<typeof runAdapterSchema>

// ── External endpoint response contract ───────────────────────────────────────
// This is what the external tool MUST return (minimum) and MAY return (full).
// Additional top-level fields are allowed and stored verbatim in rawResponse.

const screenFilterResultSchema = z.object({
  pass: z.boolean(),
  details: z.record(z.boolean()).default({}),
  violations: z.number().optional(),
  alerts: z.array(z.string()).optional(),
  checked: z.boolean().optional(),
})

const screenAdmetFlagSchema = z.object({
  likely: z.boolean().optional(),
  flag: z.boolean().optional(),
  basis: z.string().default(''),
})

const screenDescriptorsSchema = z.object({
  molecular_weight: z.number().optional(),
  exact_molecular_weight: z.number().optional(),
  mol_log_p: z.number().optional(),
  hbd: z.number().optional(),
  hba: z.number().optional(),
  tpsa: z.number().optional(),
  rotatable_bonds: z.number().optional(),
  aromatic_rings: z.number().optional(),
  rings: z.number().optional(),
  heavy_atom_count: z.number().optional(),
  stereocenters: z.number().optional(),
  frac_csp3: z.number().optional(),
  qed: z.number().optional(),
  sa_score: z.number().nullable().optional(),
})

const screenFiltersSchema = z.object({
  lipinski: screenFilterResultSchema.optional(),
  veber: screenFilterResultSchema.optional(),
  ghose: screenFilterResultSchema.optional(),
  lead_like: screenFilterResultSchema.optional(),
  pains: screenFilterResultSchema.optional(),
})

const screenAdmetFlagsSchema = z.object({
  bbb_penetrant: screenAdmetFlagSchema.optional(),
  oral_absorption_risk: screenAdmetFlagSchema.optional(),
  pgp_substrate_risk: screenAdmetFlagSchema.optional(),
  herg_liability_risk: screenAdmetFlagSchema.optional(),
})

// Minimum: smiles + valid. Everything else is optional.
export const externalScreenResponseSchema = z.object({
  smiles: z.string(),
  valid: z.boolean(),
  canonical_smiles: z.string().nullable().optional(),
  inchi: z.string().nullable().optional(),
  inchi_key: z.string().nullable().optional(),
  sanitization_error: z.string().nullable().optional(),
  descriptors: screenDescriptorsSchema.nullable().optional(),
  filters: screenFiltersSchema.nullable().optional(),
  admet_flags: screenAdmetFlagsSchema.nullable().optional(),
  model_version: z.string().default('unknown'),
})

export type ExternalScreenResponse = z.infer<typeof externalScreenResponseSchema>
