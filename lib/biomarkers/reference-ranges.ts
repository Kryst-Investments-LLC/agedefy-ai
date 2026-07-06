/**
 * Biomarker reference ("optimal") ranges — mirrors metadata/biomarkers.yml so
 * the UI can draw optimal bands and flag out-of-range values without shipping
 * the YAML to the client. Lookup is by normalised name/alias.
 */

export interface ReferenceRange {
  low: number
  high: number
  unit: string
}

// Canonical ranges keyed by normalised name; aliases map to the same key.
const RANGES: Record<string, ReferenceRange> = {
  'hemoglobin a1c': { low: 4.0, high: 5.6, unit: '%' },
  'fasting glucose': { low: 70, high: 99, unit: 'mg/dL' },
  'ldl cholesterol': { low: 0, high: 100, unit: 'mg/dL' },
  'hdl cholesterol': { low: 40, high: 100, unit: 'mg/dL' },
  'apolipoprotein b': { low: 0, high: 90, unit: 'mg/dL' },
  'lipoprotein(a)': { low: 0, high: 75, unit: 'nmol/L' },
  'hs-crp': { low: 0, high: 1.0, unit: 'mg/L' },
  homocysteine: { low: 0, high: 10, unit: 'umol/L' },
  '25-oh vitamin d': { low: 40, high: 80, unit: 'ng/mL' },
  ferritin: { low: 30, high: 200, unit: 'ng/mL' },
  'vo2 max': { low: 35, high: 80, unit: 'mL/kg/min' },
  'dunedinpace (pace of aging)': { low: 0.6, high: 1.0, unit: 'ratio' },
  'mean telomere length': { low: 6.0, high: 12.0, unit: 'kb' },
}

const ALIASES: Record<string, string> = {
  hba1c: 'hemoglobin a1c',
  a1c: 'hemoglobin a1c',
  glucose: 'fasting glucose',
  'fasting blood glucose': 'fasting glucose',
  ldl: 'ldl cholesterol',
  'ldl-c': 'ldl cholesterol',
  hdl: 'hdl cholesterol',
  'hdl-c': 'hdl cholesterol',
  apob: 'apolipoprotein b',
  'lp(a)': 'lipoprotein(a)',
  crp: 'hs-crp',
  'hs crp': 'hs-crp',
  'c-reactive protein': 'hs-crp',
  'vitamin d': '25-oh vitamin d',
  vo2max: 'vo2 max',
  dunedinpace: 'dunedinpace (pace of aging)',
  'telomere length': 'mean telomere length',
}

function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getReferenceRange(name: string): ReferenceRange | null {
  const n = normalise(name)
  if (RANGES[n]) return RANGES[n]
  const alias = ALIASES[n]
  if (alias && RANGES[alias]) return RANGES[alias]
  return null
}

/** In-range = good. Returns null when we have no reference for this marker. */
export function biomarkerStatus(name: string, value: number): 'good' | 'out' | null {
  const r = getReferenceRange(name)
  if (!r) return null
  return value >= r.low && value <= r.high ? 'good' : 'out'
}

// Which direction of change is an improvement for a marker (null = unknown).
const HIGHER_IS_BETTER = new Set([
  'hdl cholesterol',
  '25-oh vitamin d',
  'vo2 max',
  'mean telomere length',
])
const LOWER_IS_BETTER = new Set([
  'hemoglobin a1c',
  'fasting glucose',
  'ldl cholesterol',
  'apolipoprotein b',
  'lipoprotein(a)',
  'hs-crp',
  'homocysteine',
  'dunedinpace (pace of aging)',
])

export function improvementDirection(name: string): 'up' | 'down' | null {
  const n = normalise(name)
  const key = ALIASES[n] ?? n
  if (HIGHER_IS_BETTER.has(key)) return 'up'
  if (LOWER_IS_BETTER.has(key)) return 'down'
  return null
}
