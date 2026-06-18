/**
 * External candidate sourcing via Open Targets (https://platform.opentargets.org).
 *
 * Breaks the closed-vocabulary ceiling in hypothesis generation: instead of
 * only re-surfacing compounds already listed in our curated vocabulary, this
 * resolves a free-text biological target/pathway to an Open Targets target and
 * returns the compounds Open Targets associates with it (target → knownDrugs).
 *
 * SCOPE — deliberately minimal:
 *  - Returns compound NAME + ChEMBL ID + provenance only.
 *  - Does NOT ingest Open Targets indication/mechanism text as claims. Any
 *    mechanistic reasoning is produced downstream by the critique layer and is
 *    explicitly framed as model inference, not retrieved fact.
 *  - Never throws: any failure (network, non-200, malformed body, no match)
 *    degrades to an empty list so hypothesis generation falls back to the
 *    curated vocabulary.
 *
 * No API key is required. No user health data is used.
 */

import { logger } from '@/lib/logger'

const OPEN_TARGETS_GQL = 'https://api.platform.opentargets.org/api/v4/graphql'

export interface ExternalProvenance {
  sourceName: string
  sourceUrl: string
  /** The Open Targets target symbol the free-text query resolved to. */
  matchedTarget: string
  retrievedAt: string
}

export interface ExternalCandidate {
  name: string
  chemblId: string
  source: 'open-targets'
  provenance: ExternalProvenance
}

// Resolve a free-text target/pathway string to the best-matching Open Targets target.
const SEARCH_QUERY = `query ResolveTarget($q: String!) {
  search(queryString: $q, entityNames: ["target"], page: { index: 0, size: 1 }) {
    hits { id name entity }
  }
}`

// Fetch the drugs Open Targets associates with a resolved target.
const KNOWN_DRUGS_QUERY = `query KnownDrugs($ensemblId: String!, $size: Int!) {
  target(ensemblId: $ensemblId) {
    id
    approvedSymbol
    knownDrugs(size: $size) {
      rows { drug { id name } }
    }
  }
}`

interface SearchResponse {
  data?: { search?: { hits?: Array<{ id?: string; name?: string; entity?: string }> } }
}

interface KnownDrugsResponse {
  data?: {
    target?: {
      approvedSymbol?: string
      knownDrugs?: { rows?: Array<{ drug?: { id?: string; name?: string } | null }> }
    }
  }
}

async function postGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const response = await fetch(OPEN_TARGETS_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!response.ok) return null
  return (await response.json()) as T
}

/**
 * Resolve `target` to an Open Targets target and return up to `maxResults`
 * associated compounds as candidates. Returns [] on any failure.
 */
export async function fetchExternalCandidates(
  target: string,
  maxResults = 10,
): Promise<ExternalCandidate[]> {
  try {
    // 1. Resolve the free-text target to an Ensembl gene id.
    const search = await postGraphQL<SearchResponse>(SEARCH_QUERY, { q: target })
    const hit = search?.data?.search?.hits?.[0]
    if (!hit?.id) return []

    // 2. Fetch known drugs for that target. Over-fetch because knownDrugs
    //    returns one row per drug/disease/phase combination (many duplicates).
    const drugs = await postGraphQL<KnownDrugsResponse>(KNOWN_DRUGS_QUERY, {
      ensemblId: hit.id,
      size: maxResults * 4,
    })
    const targetNode = drugs?.data?.target
    if (!targetNode) return []

    const matchedTarget = targetNode.approvedSymbol || hit.name || target
    const rows = targetNode.knownDrugs?.rows ?? []

    const seen = new Set<string>()
    const candidates: ExternalCandidate[] = []
    const retrievedAt = new Date().toISOString()

    for (const row of rows) {
      const drug = row?.drug
      if (!drug?.id || !drug?.name) continue
      if (seen.has(drug.id)) continue
      seen.add(drug.id)
      candidates.push({
        name: drug.name,
        chemblId: drug.id,
        source: 'open-targets',
        provenance: {
          sourceName: 'Open Targets',
          sourceUrl: `https://platform.opentargets.org/drug/${drug.id}`,
          matchedTarget,
          retrievedAt,
        },
      })
      if (candidates.length >= maxResults) break
    }

    return candidates
  } catch (err) {
    logger.warn('Open Targets external candidate fetch failed', { target, error: String(err) })
    return []
  }
}
