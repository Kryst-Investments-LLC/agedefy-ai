import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { NOT_MEDICAL_ADVICE_DISCLAIMER } from "@/lib/ai/health-guardrail-rules"
import { fanOut } from "@/lib/research/fan-out"
import { rerank, type RankableItem } from "@/lib/research/reranker"
import { decomposeQuery } from "@/lib/research/query-decomposer"

const searchSchema = z.object({
  q: z.string().min(2).max(500),
  k: z.coerce.number().int().min(1).max(50).optional().default(20),
})

/**
 * GET /api/research/search?q=...&k=20
 *
 * Unified research search endpoint:
 *   1. Fan-out to PubMed + ClinicalTrials.gov + vocabulary in parallel
 *   2. Re-rank all results with BM25 token overlap
 *   3. Return top-k with persistent "not medical advice" disclaimer
 *
 * No user health data is used for ranking. Query relevance only.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = searchSchema.safeParse({
    q: searchParams.get("q"),
    k: searchParams.get("k"),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { q, k } = parsed.data
  const decomposed = decomposeQuery(q)

  const { pubmed, clinicalTrials, vocabulary, errors } = await fanOut(decomposed.cleanQuery, {
    maxPubMed: 30,
    maxClinicalTrials: 15,
    maxVocabulary: 10,
  })

  const items: RankableItem[] = [
    ...pubmed.map((p) => ({
      id: `pmid:${p.pmid}`,
      text: `${p.title} ${p.authors} ${p.source}`,
      source: 'pubmed' as const,
      metadata: { pmid: p.pmid, title: p.title, url: `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`, year: extractYear(p.publishedDate) },
    })),
    ...clinicalTrials.map((t) => ({
      id: `nct:${t.nctId}`,
      text: `${t.title} ${t.conditions.join(' ')} ${t.status}`,
      source: 'clinicaltrials' as const,
      metadata: { nctId: t.nctId, title: t.title, url: t.url, status: t.status },
    })),
    ...vocabulary.map((v) => ({
      id: `vocab:${v.id}`,
      text: `${v.name} ${v.description}`,
      source: 'vocabulary' as const,
      metadata: { vocabId: v.id, name: v.name, type: v.type, description: v.description },
    })),
  ]

  const ranked = rerank(q, items).slice(0, k)

  return NextResponse.json(
    {
      query: q,
      decomposed: {
        compoundIds: decomposed.compoundIds,
        pathwayIds: decomposed.pathwayIds,
        studyTypeHints: decomposed.studyTypeHints,
      },
      results: ranked.map((item) => ({
        id: item.id,
        source: item.source,
        score: item.score,
        ...item.metadata,
      })),
      sources: {
        pubmed: pubmed.length,
        clinicalTrials: clinicalTrials.length,
        vocabulary: vocabulary.length,
      },
      errors: errors.length > 0 ? errors : undefined,
      disclaimer: NOT_MEDICAL_ADVICE_DISCLAIMER,
    },
    { status: 200 },
  )
}

function extractYear(dateStr: string): number | null {
  const match = dateStr.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0], 10) : null
}
