/**
 * Drug-drug interaction lookup.
 *
 * Reads the DrugDrugInteraction table (CPIC/DrugBank/PharmGKB-derived) for
 * a candidate compound against the patient's current medication list. The
 * SafetyAgent should call this before greenlighting any chronic dosing
 * recommendation.
 */

import { db } from "@/lib/db"

export interface DdiHit {
  drugA: string
  drugB: string
  mechanism: string
  severity: "minor" | "moderate" | "major" | "contraindicated"
  evidenceGrade: "A" | "B" | "C" | "D"
  source: string
  notes: string | null
}

const SEVERITY_RANK: Record<string, number> = {
  minor: 1,
  moderate: 2,
  major: 3,
  contraindicated: 4,
}

export async function checkDrugInteractions(
  candidateDrug: string,
  currentDrugs: string[],
): Promise<DdiHit[]> {
  if (currentDrugs.length === 0) return []
  const rows = await db.drugDrugInteraction.findMany({
    where: {
      OR: [
        { drugA: candidateDrug, drugB: { in: currentDrugs } },
        { drugB: candidateDrug, drugA: { in: currentDrugs } },
      ],
    },
    take: 200,
  })
  return rows
    .map((r) => ({
      drugA: r.drugA,
      drugB: r.drugB,
      mechanism: r.mechanism,
      severity: r.severity as DdiHit["severity"],
      evidenceGrade: r.evidenceGrade as DdiHit["evidenceGrade"],
      source: r.source,
      notes: r.notes,
    }))
    .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))
}

export function hasContraindication(hits: DdiHit[]): boolean {
  return hits.some((h) => h.severity === "contraindicated")
}
