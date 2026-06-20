/**
 * Biomarker → organ/system mapping and status classification.
 *
 * Pure, dependency-free, and unit-tested. Drives the 3D anatomy viewer
 * (which organ lights up, and in what colour) and the 3D data dashboard.
 *
 * This is descriptive research tooling, not a diagnostic. Status buckets are
 * coarse ("optimal / borderline / out of range") and must never be presented
 * as medical interpretation.
 */

export type OrganSystem =
  | "cardiovascular"
  | "liver"
  | "kidney"
  | "metabolic"
  | "thyroid"
  | "immune"
  | "hematology"
  | "endocrine"

export type BiomarkerStatus = "optimal" | "borderline" | "out_of_range" | "unknown"
export type Direction = "low" | "normal" | "high" | "unknown"

export interface BiomarkerInput {
  name: string
  value: number
  unit?: string | null
  /** Optional per-user target; when present it overrides the built-in range. */
  target?: number | null
}

export interface ClassifiedBiomarker extends BiomarkerInput {
  organ: OrganSystem
  status: BiomarkerStatus
  direction: Direction
  /** 0..1 — how far outside the optimal band, for colour intensity / bar height. */
  severity: number
}

interface ReferenceRange {
  organ: OrganSystem
  /** Optimal band [low, high]. */
  optimal: [number, number]
  /** Borderline band [low, high]; outside this is out_of_range. */
  borderline: [number, number]
}

/**
 * Built-in adult reference ranges for common biomarkers, keyed by a normalized
 * name. Ranges are deliberately conservative, commonly-cited adult bands; they
 * are for visualization bucketing only.
 */
const REFERENCE_RANGES: Record<string, ReferenceRange> = {
  // ── Cardiovascular ──────────────────────────────────────────────────────
  crp:           { organ: "cardiovascular", optimal: [0, 1],    borderline: [0, 3] },
  hscrp:         { organ: "cardiovascular", optimal: [0, 1],    borderline: [0, 3] },
  ldl:           { organ: "cardiovascular", optimal: [0, 100],  borderline: [0, 130] },
  hdl:           { organ: "cardiovascular", optimal: [60, 100], borderline: [40, 100] },
  triglycerides: { organ: "cardiovascular", optimal: [0, 100],  borderline: [0, 150] },
  apob:          { organ: "cardiovascular", optimal: [0, 80],   borderline: [0, 100] },
  homocysteine:  { organ: "cardiovascular", optimal: [0, 10],   borderline: [0, 15] },

  // ── Liver ───────────────────────────────────────────────────────────────
  alt:           { organ: "liver", optimal: [0, 30],   borderline: [0, 40] },
  ast:           { organ: "liver", optimal: [0, 30],   borderline: [0, 40] },
  ggt:           { organ: "liver", optimal: [0, 30],   borderline: [0, 50] },
  alp:           { organ: "liver", optimal: [30, 100], borderline: [20, 130] },
  bilirubin:     { organ: "liver", optimal: [0, 1.0],  borderline: [0, 1.2] },
  albumin:       { organ: "liver", optimal: [4.0, 5.0], borderline: [3.5, 5.5] },

  // ── Kidney ──────────────────────────────────────────────────────────────
  creatinine:    { organ: "kidney", optimal: [0.6, 1.1], borderline: [0.5, 1.3] },
  egfr:          { organ: "kidney", optimal: [90, 140],  borderline: [60, 140] },
  bun:           { organ: "kidney", optimal: [7, 20],    borderline: [5, 25] },
  uricacid:      { organ: "kidney", optimal: [3, 6],     borderline: [2.5, 7.2] },
  cystatinc:     { organ: "kidney", optimal: [0.5, 1.0], borderline: [0.5, 1.2] },

  // ── Metabolic (pancreas) ────────────────────────────────────────────────
  glucose:       { organ: "metabolic", optimal: [70, 90],  borderline: [70, 100] },
  hba1c:         { organ: "metabolic", optimal: [4.0, 5.4], borderline: [4.0, 5.7] },
  insulin:       { organ: "metabolic", optimal: [2, 6],    borderline: [2, 10] },
  homair:        { organ: "metabolic", optimal: [0, 1.5],  borderline: [0, 2.0] },

  // ── Thyroid ─────────────────────────────────────────────────────────────
  tsh:           { organ: "thyroid", optimal: [0.8, 2.5], borderline: [0.4, 4.0] },
  ft4:           { organ: "thyroid", optimal: [1.0, 1.5], borderline: [0.8, 1.8] },
  ft3:           { organ: "thyroid", optimal: [3.0, 4.0], borderline: [2.3, 4.2] },

  // ── Immune / inflammation ───────────────────────────────────────────────
  il6:           { organ: "immune", optimal: [0, 1.8],   borderline: [0, 3.0] },
  wbc:           { organ: "immune", optimal: [4.5, 7.5], borderline: [3.5, 11] },
  ferritin:      { organ: "immune", optimal: [30, 150],  borderline: [15, 300] },

  // ── Hematology ──────────────────────────────────────────────────────────
  hemoglobin:    { organ: "hematology", optimal: [13.5, 16.5], borderline: [12, 17.5] },
  hematocrit:    { organ: "hematology", optimal: [40, 50],     borderline: [36, 52] },
  iron:          { organ: "hematology", optimal: [60, 150],    borderline: [40, 170] },

  // ── Endocrine / longevity ───────────────────────────────────────────────
  igf1:          { organ: "endocrine", optimal: [100, 200], borderline: [80, 280] },
  testosterone:  { organ: "endocrine", optimal: [450, 900], borderline: [300, 1000] },
  vitamind:      { organ: "endocrine", optimal: [40, 60],   borderline: [30, 80] },
  cortisol:      { organ: "endocrine", optimal: [6, 15],    borderline: [4, 20] },
}

/** Substrings that map a biomarker name to an organ when no exact range exists. */
const ORGAN_HINTS: Array<[RegExp, OrganSystem]> = [
  [/chol|lipid|ldl|hdl|triglyc|cardio|apo|bp|pressure/i, "cardiovascular"],
  [/liver|hepat|alt|ast|ggt|bilirubin|albumin/i, "liver"],
  [/kidney|renal|creat|egfr|urea|bun|uric/i, "kidney"],
  [/glucose|insulin|hba1c|metabolic|homa/i, "metabolic"],
  [/thyroid|tsh|t3|t4/i, "thyroid"],
  [/immune|inflamm|crp|il-?6|wbc|cytokine/i, "immune"],
  [/hemo|hematocrit|rbc|iron|ferritin|blood/i, "hematology"],
  [/hormone|igf|testosterone|estr|cortisol|vitamin/i, "endocrine"],
]

/** Normalize a biomarker name to a lookup key: lowercase, strip non-alphanumerics. */
export function normalizeBiomarkerName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function resolveOrgan(normalized: string, rawName: string): OrganSystem | null {
  const range = REFERENCE_RANGES[normalized]
  if (range) return range.organ
  for (const [pattern, organ] of ORGAN_HINTS) {
    if (pattern.test(rawName)) return organ
  }
  return null
}

/**
 * Classify a single biomarker into organ, status, direction and a 0..1 severity.
 * Uses the per-user `target` when present (±15% optimal, ±35% borderline),
 * otherwise the built-in reference range. Returns status "unknown" when neither
 * is available.
 */
export function classifyBiomarker(b: BiomarkerInput): ClassifiedBiomarker | null {
  const normalized = normalizeBiomarkerName(b.name)
  const organ = resolveOrgan(normalized, b.name)
  if (!organ) return null

  let optimal: [number, number] | null = null
  let borderline: [number, number] | null = null

  if (typeof b.target === "number" && b.target > 0) {
    optimal = [b.target * 0.85, b.target * 1.15]
    borderline = [b.target * 0.65, b.target * 1.35]
  } else {
    const range = REFERENCE_RANGES[normalized]
    if (range) {
      optimal = range.optimal
      borderline = range.borderline
    }
  }

  if (!optimal || !borderline) {
    return { ...b, organ, status: "unknown", direction: "unknown", severity: 0 }
  }

  const [oLo, oHi] = optimal
  const [bLo, bHi] = borderline
  const v = b.value

  let status: BiomarkerStatus
  let direction: Direction = "normal"
  let severity = 0

  if (v >= oLo && v <= oHi) {
    status = "optimal"
  } else if (v >= bLo && v <= bHi) {
    status = "borderline"
    direction = v < oLo ? "low" : "high"
    const edge = v < oLo ? oLo - v : v - oHi
    const band = v < oLo ? oLo - bLo : bHi - oHi
    severity = band > 0 ? Math.min(0.6, 0.3 + (edge / band) * 0.3) : 0.3
  } else {
    status = "out_of_range"
    direction = v < bLo ? "low" : "high"
    const overshoot = v < bLo ? bLo - v : v - bHi
    const scale = Math.max(Math.abs(bHi - bLo), 1)
    severity = Math.min(1, 0.6 + (overshoot / scale) * 0.4)
  }

  return { ...b, organ, status, direction, severity }
}

/** Classify a list, dropping biomarkers that map to no organ. */
export function classifyBiomarkers(list: BiomarkerInput[]): ClassifiedBiomarker[] {
  return list
    .map(classifyBiomarker)
    .filter((c): c is ClassifiedBiomarker => c !== null)
}

const ORGAN_STATUS_PRIORITY: Record<BiomarkerStatus, number> = {
  out_of_range: 3,
  borderline: 2,
  optimal: 1,
  unknown: 0,
}

export interface OrganSummary {
  organ: OrganSystem
  status: BiomarkerStatus
  severity: number
  biomarkers: ClassifiedBiomarker[]
}

/**
 * Roll classified biomarkers up to one summary per organ system. An organ's
 * status is the worst status among its biomarkers; severity is the max.
 */
export function summarizeByOrgan(classified: ClassifiedBiomarker[]): OrganSummary[] {
  const byOrgan = new Map<OrganSystem, ClassifiedBiomarker[]>()
  for (const c of classified) {
    const arr = byOrgan.get(c.organ) ?? []
    arr.push(c)
    byOrgan.set(c.organ, arr)
  }

  const summaries: OrganSummary[] = []
  for (const [organ, biomarkers] of byOrgan) {
    let status: BiomarkerStatus = "unknown"
    let severity = 0
    for (const b of biomarkers) {
      if (ORGAN_STATUS_PRIORITY[b.status] > ORGAN_STATUS_PRIORITY[status]) {
        status = b.status
      }
      severity = Math.max(severity, b.severity)
    }
    summaries.push({ organ, status, severity, biomarkers })
  }

  return summaries.sort(
    (a, b) => ORGAN_STATUS_PRIORITY[b.status] - ORGAN_STATUS_PRIORITY[a.status],
  )
}

/** Hex colour for a status — shared by the 3D viewer and the dashboard. */
export function statusColor(status: BiomarkerStatus): number {
  switch (status) {
    case "optimal":      return 0x22c55e // green-500
    case "borderline":   return 0xf59e0b // amber-500
    case "out_of_range": return 0xef4444 // red-500
    case "unknown":      return 0x64748b // slate-500
  }
}

/** Human label for an organ system. */
export function organLabel(organ: OrganSystem): string {
  const labels: Record<OrganSystem, string> = {
    cardiovascular: "Cardiovascular",
    liver: "Liver",
    kidney: "Kidney",
    metabolic: "Metabolic",
    thyroid: "Thyroid",
    immune: "Immune",
    hematology: "Hematology",
    endocrine: "Endocrine",
  }
  return labels[organ]
}
