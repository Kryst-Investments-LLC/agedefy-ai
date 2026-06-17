/**
 * Fan-out: parallel retrieval across PubMed, ClinicalTrials.gov, and
 * vocabulary. Uses Promise.allSettled so a single source failure cannot
 * block results from the other sources.
 *
 * All results are returned as-is. Re-ranking is the caller's responsibility
 * (see reranker.ts). No user health data is used here.
 */

import { searchPubMed, fetchPubMedSummaries, type PubMedArticleSummary } from '@/lib/research'
import { searchClinicalTrials, type ClinicalTrialStudy } from '@/lib/clinical-trials'
import { searchVocabulary, type VocabSearchResult } from './vocabulary-search'

// Re-export types so callers don't need to reach into separate modules
export type { PubMedArticleSummary, ClinicalTrialStudy, VocabSearchResult }

export interface FanOutOptions {
  maxPubMed?: number
  maxClinicalTrials?: number
  maxVocabulary?: number
}

export interface FanOutError {
  source: 'pubmed' | 'clinicaltrials' | 'vocabulary'
  error: string
}

export interface FanOutResult {
  pubmed: PubMedArticleSummary[]
  clinicalTrials: ClinicalTrialStudy[]
  vocabulary: VocabSearchResult[]
  errors: FanOutError[]
}

const DEFAULT_MAX_PUBMED = 20
const DEFAULT_MAX_CT = 10
const DEFAULT_MAX_VOCAB = 10

export async function fanOut(query: string, options: FanOutOptions = {}): Promise<FanOutResult> {
  const maxPubMed = options.maxPubMed ?? DEFAULT_MAX_PUBMED
  const maxCT = options.maxClinicalTrials ?? DEFAULT_MAX_CT
  const maxVocab = options.maxVocabulary ?? DEFAULT_MAX_VOCAB

  const [pubmedResult, ctResult, vocabResult] = await Promise.allSettled([
    searchPubMed(query, maxPubMed).then((r) => fetchPubMedSummaries(r.pmids)),
    searchClinicalTrials(query, maxCT),
    Promise.resolve(searchVocabulary(query, maxVocab)),
  ])

  const errors: FanOutError[] = []

  const pubmed = pubmedResult.status === 'fulfilled'
    ? pubmedResult.value
    : (errors.push({ source: 'pubmed', error: String((pubmedResult as PromiseRejectedResult).reason) }), [])

  const clinicalTrials = ctResult.status === 'fulfilled'
    ? ctResult.value
    : (errors.push({ source: 'clinicaltrials', error: String((ctResult as PromiseRejectedResult).reason) }), [])

  const vocabulary = vocabResult.status === 'fulfilled'
    ? vocabResult.value
    : (errors.push({ source: 'vocabulary', error: String((vocabResult as PromiseRejectedResult).reason) }), [])

  return { pubmed, clinicalTrials, vocabulary, errors }
}
