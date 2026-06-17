/**
 * Rule-based query decomposer.
 *
 * Extracts vocabulary entity IDs (compounds, pathways, biomarkers) and
 * study-type keywords from free-text queries. Ranking by relevance TO THE
 * QUERY is the only purpose — user health data is never touched here.
 */

import { COMPOUNDS, PATHWAYS, BIOMARKERS } from './vocabulary-data'

export interface DecomposedQuery {
  originalQuery: string
  compoundIds: string[]
  pathwayIds: string[]
  biomarkerIds: string[]
  studyTypeHints: string[]
  cleanQuery: string
}

const STUDY_TYPE_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /\b(?:rct|randomis(?:ed|ed)\s+controlled\s+trial|randomized\s+controlled\s+trial)\b/i, hint: 'RCT' },
  { pattern: /\bmeta[- ]?analysis\b/i, hint: 'meta-analysis' },
  { pattern: /\bsystematic\s+review\b/i, hint: 'systematic-review' },
  { pattern: /\bobservational\b/i, hint: 'observational' },
  { pattern: /\bclinical\s+trial\b/i, hint: 'clinical-trial' },
  { pattern: /\banimal\s+(?:study|model|model)\b/i, hint: 'animal-study' },
  { pattern: /\bin\s+(?:vivo|vitro)\b/i, hint: 'preclinical' },
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesAny(normalizedQuery: string, terms: string[]): boolean {
  return terms.some((t) => {
    const n = normalize(t).trim()
    if (n.length === 0) return false
    return new RegExp(`\\b${escapeRegex(n)}\\b`).test(normalizedQuery)
  })
}

export function decomposeQuery(query: string): DecomposedQuery {
  const qNorm = normalize(query)

  const compoundIds: string[] = []
  for (const c of COMPOUNDS) {
    const names = [c.name, ...c.aliases]
    if (matchesAny(qNorm, names)) compoundIds.push(c.id)
  }

  const pathwayIds: string[] = []
  for (const p of PATHWAYS) {
    if (qNorm.includes(normalize(p.name)) || qNorm.includes(p.id.replace(/_/g, ' '))) {
      pathwayIds.push(p.id)
    }
  }

  const biomarkerIds: string[] = []
  for (const b of BIOMARKERS) {
    if (qNorm.includes(normalize(b.name))) biomarkerIds.push(b.id)
  }

  const studyTypeHints: string[] = []
  for (const { pattern, hint } of STUDY_TYPE_PATTERNS) {
    if (pattern.test(query)) studyTypeHints.push(hint)
  }

  // Build a clean query: replace known entity names with their canonical IDs
  // so downstream search terms are more consistent.
  let cleanQuery = query
  for (const c of COMPOUNDS) {
    for (const alias of c.aliases) {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${alias}\\b`, 'gi'), c.name)
    }
  }

  return {
    originalQuery: query,
    compoundIds,
    pathwayIds,
    biomarkerIds,
    studyTypeHints,
    cleanQuery: cleanQuery.trim(),
  }
}
