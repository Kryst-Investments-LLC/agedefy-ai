import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { NOT_MEDICAL_ADVICE_DISCLAIMER } from "@/lib/ai/health-guardrail-rules"
import { searchVocabulary, type VocabEntryType } from "@/lib/research/vocabulary-search"

const VALID_TYPES = new Set<VocabEntryType>(['compound', 'pathway', 'biomarker'])

/**
 * GET /api/research/vocabulary?q=rapamycin&type=compound&limit=20
 *
 * Encyclopedic reference lookup — never prescriptive.
 * Every result carries the persistent "not medical advice" disclaimer.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  const rawType = searchParams.get("type")
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10) || 20))

  const typeFilter = rawType && VALID_TYPES.has(rawType as VocabEntryType)
    ? (rawType as VocabEntryType)
    : null

  const results = searchVocabulary(q, limit * 3) // over-fetch then filter
    .filter((r) => typeFilter === null || r.type === typeFilter)
    .slice(0, limit)

  return NextResponse.json(
    {
      query: q || null,
      type: typeFilter,
      count: results.length,
      results,
      disclaimer: NOT_MEDICAL_ADVICE_DISCLAIMER,
    },
    { status: 200 },
  )
}
