import { z } from 'zod'

export const librarySearchCriteriaSchema = z
  .object({
    // ── Target ──────────────────────────────────────────────────────────────
    /** ChEMBL target preferred-name substring (case-insensitive). */
    targetName: z.string().trim().min(2).max(200).optional(),
    /** Exact ChEMBL target ID (CHEMBL\d+). Skips the name-to-ID lookup. */
    targetChemblId: z
      .string()
      .trim()
      .regex(/^CHEMBL\d+$/, 'Must be a valid ChEMBL target ID, e.g. CHEMBL2842')
      .optional(),

    // ── Property filters ────────────────────────────────────────────────────
    /** Molecular weight lower bound (g/mol). */
    mwMin: z.number().nonnegative().max(2000).optional(),
    /** Molecular weight upper bound (g/mol, Lipinski rule: ≤ 500). */
    mwMax: z.number().nonnegative().max(2000).optional(),
    /** LogP (Wildman-Crippen) lower bound. */
    logpMin: z.number().min(-10).max(20).optional(),
    /** LogP upper bound (Lipinski rule: ≤ 5). */
    logpMax: z.number().min(-10).max(20).optional(),
    /** H-bond donor count upper bound (Lipinski rule: ≤ 5). */
    hbdMax: z.number().int().nonnegative().max(20).optional(),
    /** H-bond acceptor count upper bound (Lipinski rule: ≤ 10). */
    hbaMax: z.number().int().nonnegative().max(30).optional(),
    /** Topological polar surface area upper bound (Å²; oral bioavailability rule: ≤ 140). */
    tpsaMax: z.number().nonnegative().max(500).optional(),
    /** Rotatable bond count upper bound. */
    rotatableBondsMax: z.number().int().nonnegative().max(50).optional(),

    // ── Activity / clinical filters ─────────────────────────────────────────
    /** Minimum ChEMBL max_phase (0 = preclinical, 4 = approved). */
    minClinicalPhase: z.number().int().min(0).max(4).optional(),
    /**
     * Minimum pChEMBL value (−log₁₀ of standard value in M).
     * 5 ≈ 10 µM,  6 ≈ 1 µM,  7 ≈ 100 nM,  8 ≈ 10 nM.
     */
    minPchemblValue: z.number().min(0).max(15).optional(),
    /**
     * ChEMBL assay type code.
     * B = Binding, F = Functional, A = ADMET, P = Physicochemical, U = Unclassified.
     */
    assayType: z.enum(['B', 'F', 'A', 'P', 'U']).optional(),

    // ── Scope ───────────────────────────────────────────────────────────────
    /** Maximum hits returned (1–100, default 25). */
    maxResults: z.number().int().min(1).max(100).default(25),
  })
  .refine(
    (v) =>
      v.targetName !== undefined ||
      v.targetChemblId !== undefined ||
      v.mwMin !== undefined ||
      v.mwMax !== undefined ||
      v.logpMin !== undefined ||
      v.logpMax !== undefined ||
      v.hbdMax !== undefined ||
      v.hbaMax !== undefined ||
      v.tpsaMax !== undefined ||
      v.rotatableBondsMax !== undefined ||
      v.minClinicalPhase !== undefined ||
      v.minPchemblValue !== undefined,
    { message: 'At least one search criterion must be provided' },
  )

export type LibrarySearchCriteria = z.infer<typeof librarySearchCriteriaSchema>
