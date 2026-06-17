/**
 * Encyclopedic vocabulary search over compounds, pathways, and biomarkers.
 *
 * Returns structured reference entries — never prescriptive recommendations.
 * The disclaimer field is present on every result to satisfy the hard boundary:
 * "every surfaced result must carry research information, not medical advice framing."
 */

import { NOT_MEDICAL_ADVICE_DISCLAIMER } from '@/lib/ai/health-guardrail-rules'
import { COMPOUNDS, PATHWAYS, BIOMARKERS, type VocabCompound, type VocabPathway, type VocabBiomarker } from './vocabulary-data'

export type VocabEntryType = 'compound' | 'pathway' | 'biomarker'

export interface VocabSearchResult {
  id: string
  type: VocabEntryType
  name: string
  description: string
  relatedIds: string[]
  prescriptionOnly?: boolean
  disclaimer: string
}

function scoreText(queryTokens: string[], text: string): number {
  const textLower = text.toLowerCase()
  return queryTokens.filter((t) => textLower.includes(t)).length
}

function compoundToResult(c: VocabCompound): VocabSearchResult {
  return {
    id: c.id,
    type: 'compound',
    name: c.name,
    description: [
      `Category: ${c.category.replace(/_/g, ' ')}`,
      c.aliases.length ? `Also known as: ${c.aliases.join(', ')}` : null,
      `Pathways studied: ${c.pathways.join(', ')}`,
      c.prescriptionOnly ? 'Prescription-only in most jurisdictions.' : null,
    ].filter(Boolean).join(' | '),
    relatedIds: c.pathways,
    prescriptionOnly: c.prescriptionOnly,
    disclaimer: NOT_MEDICAL_ADVICE_DISCLAIMER,
  }
}

function pathwayToResult(p: VocabPathway): VocabSearchResult {
  return {
    id: p.id,
    type: 'pathway',
    name: p.name,
    description: `Hallmark of aging: ${p.hallmark.replace(/_/g, ' ')}`,
    relatedIds: COMPOUNDS.filter((c) => c.pathways.includes(p.id)).map((c) => c.id),
    disclaimer: NOT_MEDICAL_ADVICE_DISCLAIMER,
  }
}

function biomarkerToResult(b: VocabBiomarker): VocabSearchResult {
  return {
    id: b.id,
    type: 'biomarker',
    name: b.name,
    description: [
      `Unit: ${b.unit}`,
      `Pathway: ${b.pathway}`,
      b.modality ? `Modality: ${b.modality}` : null,
    ].filter(Boolean).join(' | '),
    relatedIds: [b.pathway],
    disclaimer: NOT_MEDICAL_ADVICE_DISCLAIMER,
  }
}

/**
 * Search vocabulary entries by query text. Returns up to `maxResults` items
 * ranked by token-overlap score, then alphabetically for ties.
 * Returns all entries when query is empty.
 */
export function searchVocabulary(query: string, maxResults = 20): VocabSearchResult[] {
  const queryTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)

  if (queryTokens.length === 0) {
    const all: VocabSearchResult[] = [
      ...COMPOUNDS.map(compoundToResult),
      ...PATHWAYS.map(pathwayToResult),
      ...BIOMARKERS.map(biomarkerToResult),
    ]
    return all.slice(0, maxResults)
  }

  type Scored = { result: VocabSearchResult; score: number }
  const candidates: Scored[] = []

  for (const c of COMPOUNDS) {
    const searchText = [c.name, ...c.aliases, c.category, ...c.pathways].join(' ')
    const score = scoreText(queryTokens, searchText)
    if (score > 0) candidates.push({ result: compoundToResult(c), score })
  }

  for (const p of PATHWAYS) {
    const searchText = [p.name, p.id, p.hallmark].join(' ')
    const score = scoreText(queryTokens, searchText)
    if (score > 0) candidates.push({ result: pathwayToResult(p), score })
  }

  for (const b of BIOMARKERS) {
    const searchText = [b.name, b.id, b.pathway, b.modality ?? ''].join(' ')
    const score = scoreText(queryTokens, searchText)
    if (score > 0) candidates.push({ result: biomarkerToResult(b), score })
  }

  candidates.sort((a, b) => b.score - a.score || a.result.name.localeCompare(b.result.name))
  return candidates.slice(0, maxResults).map((c) => c.result)
}

