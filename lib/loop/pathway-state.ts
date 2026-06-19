/**
 * Pathway Dysregulation Classifier
 *
 * Maps a snapshot of biomarker values to known longevity-relevant biological
 * pathways. Returns pathways ordered by dysregulation severity so the Clinical
 * Planning Agent can prioritise which sub-agents to spawn.
 *
 * This is intentionally a deterministic lookup — not an LLM call — so it is
 * fast, auditable, and testable. An LLM fallback layer can be added on top when
 * no lookup rule fires (Tier 3 scope).
 */

export interface BiomarkerReading {
  value: number
  unit: string
}

export interface PathwayState {
  name: string
  /** 0–1. Higher = more dysregulated. */
  dysregulationScore: number
  /** Which biomarker readings triggered this pathway. */
  evidenceBiomarkers: string[]
  confidence: "high" | "medium" | "low"
}

/* ------------------------------------------------------------------ */
/*  Threshold rules                                                    */
/* ------------------------------------------------------------------ */

interface ThresholdRule {
  /** Biomarker name to match (case-insensitive prefix match). */
  biomarker: string
  /** Condition to evaluate (value already normalised to SI-compatible unit). */
  condition: (value: number, unit: string) => boolean
  pathway: string
  dysregulationScore: number
  confidence: "high" | "medium" | "low"
}

const RULES: ThresholdRule[] = [
  // ── Inflammation / NF-kB ─────────────────────────────────────────
  { biomarker: "hs-crp",    condition: (v) => v > 3.0,   pathway: "NF-kB / Inflammation",  dysregulationScore: 0.85, confidence: "high" },
  { biomarker: "crp",       condition: (v) => v > 3.0,   pathway: "NF-kB / Inflammation",  dysregulationScore: 0.80, confidence: "high" },
  { biomarker: "il-6",      condition: (v) => v > 7.0,   pathway: "NF-kB / Inflammation",  dysregulationScore: 0.90, confidence: "high" },
  { biomarker: "tnf-alpha", condition: (v) => v > 8.1,   pathway: "NF-kB / Inflammation",  dysregulationScore: 0.88, confidence: "medium" },

  // ── Insulin / Glucose (mTOR & metabolic) ─────────────────────────
  { biomarker: "fasting glucose",  condition: (v) => v > 100,  pathway: "Insulin Resistance / mTOR",  dysregulationScore: 0.70, confidence: "high" },
  { biomarker: "glucose",          condition: (v) => v > 100,  pathway: "Insulin Resistance / mTOR",  dysregulationScore: 0.65, confidence: "medium" },
  { biomarker: "hba1c",            condition: (v) => v > 5.7,  pathway: "Insulin Resistance / mTOR",  dysregulationScore: 0.75, confidence: "high" },
  { biomarker: "insulin",          condition: (v) => v > 25,   pathway: "Insulin Resistance / mTOR",  dysregulationScore: 0.72, confidence: "medium" },
  { biomarker: "homa-ir",          condition: (v) => v > 2.5,  pathway: "Insulin Resistance / mTOR",  dysregulationScore: 0.80, confidence: "high" },

  // ── AMPK / Mitochondrial function ────────────────────────────────
  { biomarker: "lactate",          condition: (v) => v > 2.0,  pathway: "AMPK / Mitochondrial",  dysregulationScore: 0.70, confidence: "medium" },
  { biomarker: "atp",              condition: (v) => v < 0.8,  pathway: "AMPK / Mitochondrial",  dysregulationScore: 0.75, confidence: "low" },
  { biomarker: "vo2max",           condition: (v) => v < 35,   pathway: "AMPK / Mitochondrial",  dysregulationScore: 0.65, confidence: "medium" },
  { biomarker: "resting heart rate", condition: (v) => v > 80, pathway: "AMPK / Mitochondrial",  dysregulationScore: 0.45, confidence: "low" },

  // ── NAD+ / Sirtuin axis ──────────────────────────────────────────
  { biomarker: "nad+",    condition: (v) => v < 25,   pathway: "NAD+ / Sirtuin",  dysregulationScore: 0.80, confidence: "medium" },
  { biomarker: "nad",     condition: (v) => v < 25,   pathway: "NAD+ / Sirtuin",  dysregulationScore: 0.75, confidence: "medium" },
  { biomarker: "nmn",     condition: (v) => v < 10,   pathway: "NAD+ / Sirtuin",  dysregulationScore: 0.60, confidence: "low" },

  // ── Cellular senescence ───────────────────────────────────────────
  { biomarker: "p21",      condition: (v) => v > 2.0,  pathway: "Cellular Senescence",  dysregulationScore: 0.80, confidence: "medium" },
  { biomarker: "p16",      condition: (v) => v > 1.5,  pathway: "Cellular Senescence",  dysregulationScore: 0.75, confidence: "low" },
  { biomarker: "gdf-15",   condition: (v) => v > 1200, pathway: "Cellular Senescence",  dysregulationScore: 0.78, confidence: "medium" },
  { biomarker: "pai-1",    condition: (v) => v > 50,   pathway: "Cellular Senescence",  dysregulationScore: 0.70, confidence: "medium" },

  // ── HPA axis / Cortisol ──────────────────────────────────────────
  { biomarker: "cortisol", condition: (v) => v > 20,   pathway: "HPA Axis / Cortisol",  dysregulationScore: 0.65, confidence: "high" },
  { biomarker: "dhea-s",   condition: (v) => v < 80,   pathway: "HPA Axis / Cortisol",  dysregulationScore: 0.60, confidence: "medium" },

  // ── GH / IGF-1 axis ──────────────────────────────────────────────
  { biomarker: "igf-1",    condition: (v) => v < 100,  pathway: "GH / IGF-1 Axis",  dysregulationScore: 0.68, confidence: "medium" },
  { biomarker: "igf1",     condition: (v) => v < 100,  pathway: "GH / IGF-1 Axis",  dysregulationScore: 0.68, confidence: "medium" },
  { biomarker: "growth hormone", condition: (v) => v < 0.4, pathway: "GH / IGF-1 Axis", dysregulationScore: 0.55, confidence: "low" },

  // ── Thyroid ───────────────────────────────────────────────────────
  { biomarker: "tsh",      condition: (v) => v > 4.5 || v < 0.4, pathway: "Thyroid",  dysregulationScore: 0.72, confidence: "high" },
  { biomarker: "free t4",  condition: (v) => v < 0.8 || v > 1.8, pathway: "Thyroid",  dysregulationScore: 0.65, confidence: "medium" },
  { biomarker: "free t3",  condition: (v) => v < 2.0 || v > 4.4, pathway: "Thyroid",  dysregulationScore: 0.62, confidence: "medium" },

  // ── Cardiovascular / Lipid ────────────────────────────────────────
  { biomarker: "ldl",        condition: (v) => v > 130,  pathway: "Cardiovascular / Lipid",  dysregulationScore: 0.70, confidence: "high" },
  { biomarker: "apob",       condition: (v) => v > 100,  pathway: "Cardiovascular / Lipid",  dysregulationScore: 0.75, confidence: "high" },
  { biomarker: "lipoprotein", condition: (v) => v > 30,  pathway: "Cardiovascular / Lipid",  dysregulationScore: 0.80, confidence: "high" },
  { biomarker: "triglycerides", condition: (v) => v > 150, pathway: "Cardiovascular / Lipid", dysregulationScore: 0.65, confidence: "high" },
  { biomarker: "homocysteine", condition: (v) => v > 15,  pathway: "Cardiovascular / Lipid",  dysregulationScore: 0.72, confidence: "medium" },

  // ── Kidney / Renal ────────────────────────────────────────────────
  { biomarker: "egfr",       condition: (v) => v < 60,   pathway: "Renal Function",  dysregulationScore: 0.75, confidence: "high" },
  { biomarker: "creatinine", condition: (v) => v > 1.2,  pathway: "Renal Function",  dysregulationScore: 0.60, confidence: "medium" },
  { biomarker: "cystatin c", condition: (v) => v > 1.0,  pathway: "Renal Function",  dysregulationScore: 0.70, confidence: "medium" },

  // ── Liver / Metabolic ─────────────────────────────────────────────
  { biomarker: "alt",        condition: (v) => v > 40,   pathway: "Liver / Metabolic",  dysregulationScore: 0.65, confidence: "high" },
  { biomarker: "ast",        condition: (v) => v > 40,   pathway: "Liver / Metabolic",  dysregulationScore: 0.65, confidence: "high" },
  { biomarker: "ggt",        condition: (v) => v > 50,   pathway: "Liver / Metabolic",  dysregulationScore: 0.60, confidence: "medium" },

  // ── Testosterone / Sex hormones ───────────────────────────────────
  { biomarker: "testosterone", condition: (v) => v < 300, pathway: "Sex Hormones",  dysregulationScore: 0.68, confidence: "medium" },
  { biomarker: "free testosterone", condition: (v) => v < 5, pathway: "Sex Hormones", dysregulationScore: 0.70, confidence: "medium" },
  { biomarker: "estradiol",  condition: (v) => v < 20 || v > 250, pathway: "Sex Hormones", dysregulationScore: 0.62, confidence: "medium" },
  { biomarker: "shbg",       condition: (v) => v > 60 || v < 10,  pathway: "Sex Hormones", dysregulationScore: 0.55, confidence: "low" },

  // ── Epigenetic / Methylation ──────────────────────────────────────
  { biomarker: "biological age", condition: (v, _u) => v > 0, pathway: "Epigenetic Aging", dysregulationScore: 0.60, confidence: "medium" },
  { biomarker: "dna methylation", condition: (v) => v > 0,    pathway: "Epigenetic Aging", dysregulationScore: 0.60, confidence: "low" },
]

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Given the latest biomarker readings from a PhysiologicalSnapshot,
 * return dysregulated pathways sorted by severity (highest score first).
 *
 * Each pathway is deduplicated — multiple biomarkers can reinforce the
 * same pathway and their scores are averaged with a weight toward the max.
 */
export function identifyDysregulatedPathways(
  biomarkers: Record<string, BiomarkerReading>,
): PathwayState[] {
  // Accumulate per-pathway evidence
  const pathwayEvidence = new Map<
    string,
    { scores: number[]; biomarkers: string[]; confidence: "high" | "medium" | "low" }
  >()

  for (const [rawName, reading] of Object.entries(biomarkers)) {
    const name = rawName.toLowerCase().trim()

    for (const rule of RULES) {
      if (!name.includes(rule.biomarker.toLowerCase())) continue
      if (!rule.condition(reading.value, reading.unit)) continue

      const existing = pathwayEvidence.get(rule.pathway)
      if (existing) {
        existing.scores.push(rule.dysregulationScore)
        existing.biomarkers.push(rawName)
        // Upgrade confidence if any evidence is higher-grade
        if (confidenceRank(rule.confidence) > confidenceRank(existing.confidence)) {
          existing.confidence = rule.confidence
        }
      } else {
        pathwayEvidence.set(rule.pathway, {
          scores: [rule.dysregulationScore],
          biomarkers: [rawName],
          confidence: rule.confidence,
        })
      }
    }
  }

  // Compute final score per pathway: max × 0.7 + mean × 0.3 (weight toward worst signal)
  const result: PathwayState[] = []
  for (const [pathway, evidence] of pathwayEvidence.entries()) {
    const max = Math.max(...evidence.scores)
    const mean = evidence.scores.reduce((a, b) => a + b, 0) / evidence.scores.length
    result.push({
      name: pathway,
      dysregulationScore: Math.min(1, max * 0.7 + mean * 0.3),
      evidenceBiomarkers: [...new Set(evidence.biomarkers)],
      confidence: evidence.confidence,
    })
  }

  return result.sort((a, b) => b.dysregulationScore - a.dysregulationScore)
}

function confidenceRank(c: "high" | "medium" | "low"): number {
  return c === "high" ? 2 : c === "medium" ? 1 : 0
}
