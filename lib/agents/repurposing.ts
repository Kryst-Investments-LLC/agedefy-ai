/**
 * CMap-style drug repurposing.
 *
 * Computes a connectivity-style score between a patient transcriptomic
 * signature (genes ↑ in disease, ↓ in disease) and a candidate compound's
 * reference perturbation signature (genes ↑/↓ on treatment).
 *
 * Output range: −1 (perfectly anti-correlated → strong repurposing
 * candidate) to +1 (perfectly mimics the disease state → avoid).
 */

import { db } from "@/lib/db"

export interface TranscriptSignatureLists {
  upGenes: string[]
  downGenes: string[]
}

export interface CompoundPerturbationSignature {
  compoundId: string
  upGenes: string[]
  downGenes: string[]
  source: string
}

/**
 * Connectivity score: fraction of patient's UP genes that the compound
 * pushes DOWN, minus the fraction it pushes UP. Symmetric for the
 * patient's DOWN genes. Bounded to [−1, +1].
 */
export function connectivityScore(
  patient: TranscriptSignatureLists,
  compound: CompoundPerturbationSignature,
): number {
  const cmpUp = new Set(compound.upGenes.map((g) => g.toUpperCase()))
  const cmpDown = new Set(compound.downGenes.map((g) => g.toUpperCase()))
  const pUp = patient.upGenes.map((g) => g.toUpperCase())
  const pDown = patient.downGenes.map((g) => g.toUpperCase())
  if (pUp.length === 0 && pDown.length === 0) return 0

  let score = 0
  let total = 0
  for (const g of pUp) {
    total++
    if (cmpDown.has(g)) score -= 1
    else if (cmpUp.has(g)) score += 1
  }
  for (const g of pDown) {
    total++
    if (cmpUp.has(g)) score -= 1
    else if (cmpDown.has(g)) score += 1
  }
  return total === 0 ? 0 : score / total
}

export async function persistRepurposingScore(
  signatureId: string,
  compoundId: string,
  score: number,
  source: string,
  options: { tenantId?: string } = {},
): Promise<string> {
  const row = await db.drugRepurposingScore.create({
    data: {
      tenantId: options.tenantId ?? "default",
      signatureId,
      compoundId,
      cmapScore: Math.max(-1, Math.min(1, score)),
      source,
    },
    select: { id: true },
  })
  return row.id
}
