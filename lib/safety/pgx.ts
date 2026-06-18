/**
 * Pharmacogenomics-aware dosing checks.
 *
 * Returns CPIC-style guidance for a candidate compound given the patient's
 * stored PharmacogenomicProfile. Used by SafetyAgent before recommending
 * any drug that is metabolized by a polymorphic enzyme.
 *
 * This is intentionally a thin, deterministic table lookup — production
 * deployments should plug a CPIC table loader behind `lookupCpicGuidance`.
 */

import type { PgxMetabolizerPhenotype } from "@prisma/client"

import { db } from "@/lib/db"
import { safeJsonParse } from "@/lib/safe-json"

import { loadCpicTable } from "./pgx-loader"

export interface PgxVariant {
  gene: string
  diplotype: string
  phenotype: PgxMetabolizerPhenotype
  activityScore?: number
}

export type PgxRecommendationLevel = "USE_AS_DIRECTED" | "ADJUST_DOSE" | "ALTERNATIVE_PREFERRED" | "AVOID"

export interface PgxRecommendation {
  gene: string
  phenotype: PgxMetabolizerPhenotype
  level: PgxRecommendationLevel
  rationale: string
  source: string // e.g. "CPIC v2024.1"
}

/**
 * Minimal in-memory CPIC lookup. A production rollout should replace this
 * with a maintained CPIC dataset (https://cpicpgx.org/guidelines/).
 */
const CPIC_TABLE: Array<{
  drug: string
  gene: string
  phenotype: PgxMetabolizerPhenotype
  level: PgxRecommendationLevel
  rationale: string
}> = [
  { drug: "clopidogrel", gene: "CYP2C19", phenotype: "POOR", level: "ALTERNATIVE_PREFERRED", rationale: "Reduced active metabolite; consider prasugrel or ticagrelor." },
  { drug: "clopidogrel", gene: "CYP2C19", phenotype: "INTERMEDIATE", level: "ALTERNATIVE_PREFERRED", rationale: "Reduced active metabolite; consider prasugrel or ticagrelor." },
  { drug: "warfarin", gene: "CYP2C9", phenotype: "POOR", level: "ADJUST_DOSE", rationale: "Reduce dose 50–75% and monitor INR closely." },
  { drug: "warfarin", gene: "VKORC1", phenotype: "INTERMEDIATE", level: "ADJUST_DOSE", rationale: "Use pharmacogenomic dosing algorithm (e.g. IWPC)." },
  { drug: "codeine", gene: "CYP2D6", phenotype: "ULTRARAPID", level: "AVOID", rationale: "Risk of opioid toxicity from rapid morphine formation." },
  { drug: "codeine", gene: "CYP2D6", phenotype: "POOR", level: "ALTERNATIVE_PREFERRED", rationale: "Inadequate analgesia from poor morphine conversion." },
  { drug: "tamoxifen", gene: "CYP2D6", phenotype: "POOR", level: "ALTERNATIVE_PREFERRED", rationale: "Reduced endoxifen formation; consider aromatase inhibitor." },
  { drug: "rapamycin", gene: "CYP3A5", phenotype: "RAPID", level: "ADJUST_DOSE", rationale: "Increased clearance; titrate to trough levels." },
]

export function lookupCpicGuidance(
  drug: string,
  variants: PgxVariant[],
): PgxRecommendation[] {
  const drugKey = drug.toLowerCase()
  const loaded = loadCpicTable()
  // External CPIC release rows shadow in-tree rows on (drug, gene, phenotype).
  // Source label reflects which table actually produced the hit so the UI
  // can show the operator whether they are running on the maintained CPIC
  // release or the dev fallback.
  const out: PgxRecommendation[] = []
  for (const v of variants) {
    const loadedHit = loaded?.rows.find(
      (row) => row.drug === drugKey && row.gene === v.gene && row.phenotype === v.phenotype,
    )
    if (loadedHit) {
      out.push({
        gene: v.gene,
        phenotype: v.phenotype,
        level: loadedHit.level,
        rationale: loadedHit.rationale,
        source: `${loaded!.source} ${loaded!.version}`,
      })
      continue
    }
    const hit = CPIC_TABLE.find(
      (row) => row.drug === drugKey && row.gene === v.gene && row.phenotype === v.phenotype,
    )
    if (hit) {
      out.push({
        gene: v.gene,
        phenotype: v.phenotype,
        level: hit.level,
        rationale: hit.rationale,
        source: "CPIC (in-tree minimal table)",
      })
    }
  }
  return out
}

/**
 * Loads the patient's stored PGx variants and returns recommendations for
 * a given compound. Returns an empty array if the patient has no PGx
 * profile on file (the safety agent should treat that as "unknown" rather
 * than "safe").
 */
export async function getPgxRecommendationsForUser(
  userId: string,
  drug: string,
): Promise<PgxRecommendation[]> {
  const profile = await db.pharmacogenomicProfile.findUnique({
    where: { userId },
    select: { variantsJson: true },
  })
  if (!profile) return []
  const variants = (profile.variantsJson as unknown as PgxVariant[]) ?? []
  return lookupCpicGuidance(drug, variants)
}
