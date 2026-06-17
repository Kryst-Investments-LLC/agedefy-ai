/**
 * Citation verifier: checks whether a claim's key terms appear in a
 * PubMed abstract. Drops citations that cannot be verified rather than
 * surfacing hallucinated sources.
 *
 * No LLM is used — pure token-overlap on the retrieved abstract text.
 */

import { fetchPubMedAbstract } from '@/lib/research'
import { tokenize } from './reranker'

export type CitationStatus = 'verified' | 'mismatch' | 'unverifiable'

export interface CitationVerification {
  pmid: string
  claimText: string
  status: CitationStatus
  matchRate: number
  reason: string
}

const VERIFIED_THRESHOLD = 0.35

/**
 * Verify that `claimText` is supportable by the abstract of `pmid`.
 *
 * Uses the injected `fetchAbstractFn` (defaults to `fetchPubMedAbstract`)
 * so callers can stub it in tests without mocking the module.
 */
export async function verifyCitation(
  claimText: string,
  pmid: string,
  fetchAbstractFn: (pmid: string) => Promise<string | null> = fetchPubMedAbstract,
): Promise<CitationVerification> {
  let abstract: string | null
  try {
    abstract = await fetchAbstractFn(pmid)
  } catch {
    return { pmid, claimText, status: 'unverifiable', matchRate: 0, reason: 'Abstract fetch failed' }
  }

  if (!abstract) {
    return { pmid, claimText, status: 'unverifiable', matchRate: 0, reason: 'Abstract not available' }
  }

  const claimTokens = tokenize(claimText)
  if (claimTokens.length === 0) {
    return { pmid, claimText, status: 'unverifiable', matchRate: 0, reason: 'Claim has no indexable tokens' }
  }

  const abstractLower = abstract.toLowerCase()
  const matched = claimTokens.filter((t) => abstractLower.includes(t))
  const matchRate = matched.length / claimTokens.length

  if (matchRate >= VERIFIED_THRESHOLD) {
    return {
      pmid,
      claimText,
      status: 'verified',
      matchRate,
      reason: `${matched.length}/${claimTokens.length} key terms found in abstract`,
    }
  }

  return {
    pmid,
    claimText,
    status: 'mismatch',
    matchRate,
    reason: `Only ${matched.length}/${claimTokens.length} key terms found — abstract may not support this claim`,
  }
}

/**
 * Verify a batch of claims. Returns only verified entries plus a list of
 * dropped ones. This is the primary entry point for callers that want to
 * silently drop unverifiable citations rather than surfacing them.
 */
export async function filterVerifiedCitations<T extends { pmid: string; claimText: string }>(
  claims: T[],
  fetchAbstractFn?: (pmid: string) => Promise<string | null>,
): Promise<{ verified: T[]; dropped: Array<T & { reason: string }> }> {
  const results = await Promise.allSettled(
    claims.map(async (c) => {
      const verification = await verifyCitation(c.claimText, c.pmid, fetchAbstractFn)
      return { claim: c, verification }
    }),
  )

  const verified: T[] = []
  const dropped: Array<T & { reason: string }> = []

  for (const result of results) {
    if (result.status === 'rejected') continue
    const { claim, verification } = result.value
    if (verification.status === 'verified') {
      verified.push(claim)
    } else {
      dropped.push({ ...claim, reason: verification.reason })
    }
  }

  return { verified, dropped }
}
