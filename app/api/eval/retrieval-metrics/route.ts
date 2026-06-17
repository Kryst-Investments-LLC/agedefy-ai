import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { recallAtK, precisionAtK, ndcg } from "@/lib/eval/bench"
import { RETRIEVAL_EVAL_DATASET, type EvalQuery } from "@/lib/eval/retrieval-eval-dataset"
import { searchPubMed } from "@/lib/research"
import { searchClinicalTrials } from "@/lib/clinical-trials"
import { searchVocabulary } from "@/lib/research/vocabulary-search"

const DEFAULT_K = 10

interface QueryResult {
  queryId: string
  query: string
  source: string
  recallAtK: number
  precisionAtK: number
  ndcg: number
  retrievedIds: string[]
  relevantIds: string[]
  error?: string
}

async function retrieveIds(evalQuery: EvalQuery, k: number): Promise<string[]> {
  if (evalQuery.source === 'pubmed') {
    const result = await searchPubMed(evalQuery.query, k)
    return result.pmids
  }
  if (evalQuery.source === 'clinicaltrials') {
    const trials = await searchClinicalTrials(evalQuery.query, k)
    return trials.map((t) => t.nctId)
  }
  // vocabulary
  const results = await searchVocabulary(evalQuery.query, k)
  return results.map((r) => r.id)
}

/**
 * GET /api/eval/retrieval-metrics?k=10
 *
 * Runs the labeled retrieval eval dataset against live retrieval functions and
 * returns per-query and aggregate recall@k / precision@k / nDCG@k.
 *
 * Admin / researcher only. Calls live external APIs — rate-limit accordingly.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const k = Math.max(1, Math.min(50, parseInt(searchParams.get("k") ?? String(DEFAULT_K), 10) || DEFAULT_K))

  const results: QueryResult[] = await Promise.all(
    RETRIEVAL_EVAL_DATASET.map(async (eq) => {
      try {
        const retrievedIds = await retrieveIds(eq, k)
        return {
          queryId: eq.id,
          query: eq.query,
          source: eq.source,
          recallAtK: recallAtK(retrievedIds, eq.relevantIds, k),
          precisionAtK: precisionAtK(retrievedIds, eq.relevantIds, k),
          ndcg: ndcg(retrievedIds, eq.gradedRelevance, k),
          retrievedIds,
          relevantIds: eq.relevantIds,
        }
      } catch (err) {
        return {
          queryId: eq.id,
          query: eq.query,
          source: eq.source,
          recallAtK: 0,
          precisionAtK: 0,
          ndcg: 0,
          retrievedIds: [],
          relevantIds: eq.relevantIds,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }),
  )

  const n = results.length
  const aggregate = {
    meanRecallAtK: n > 0 ? results.reduce((s, r) => s + r.recallAtK, 0) / n : 0,
    meanPrecisionAtK: n > 0 ? results.reduce((s, r) => s + r.precisionAtK, 0) / n : 0,
    meanNdcg: n > 0 ? results.reduce((s, r) => s + r.ndcg, 0) / n : 0,
    errorCount: results.filter((r) => r.error).length,
  }

  return NextResponse.json({ k, results, aggregate }, { status: 200 })
}
