/**
 * RWE Outcomes Query — shared service for the population-edge query surfaces.
 *
 * Parses query params and runs the KgEdge POPULATION_ASSOCIATION query, then
 * applies the pure shaping + k-anon floor (see rwe-query.ts). Used by both:
 *   - GET /api/graph/outcomes         (internal, session/researcher-gated)
 *   - GET /api/v1/graph/outcomes      (external, API-key + graph:read metered)
 *
 * Centralising the query keeps the two surfaces byte-for-byte consistent.
 *
 * @module lib/knowledge-graph/rwe-outcomes-query
 */

import { KgEdgeType, KgEvidenceGrade, type Prisma } from "@prisma/client"

import { RWE_SOURCE } from "@/lib/flywheel/causal-edge-materializer"
import { db } from "@/lib/db"

import { gradeMeets, shapeRweOutcomes, type RweEdgeRow, type RweOutcomeDto } from "./rwe-query"

export const RWE_DEFAULT_LIMIT = 50
export const RWE_MAX_LIMIT = 200

const VALID_GRADES = new Set<string>(Object.values(KgEvidenceGrade))

export interface RweQueryParams {
  intervention: string | null
  biomarker: string | null
  minGrade: KgEvidenceGrade | null
  limit: number
}

export interface ParseResult {
  params?: RweQueryParams
  error?: string
}

/** Parse + validate query params (pure). Returns an error string when invalid. */
export function parseRweQueryParams(searchParams: URLSearchParams): ParseResult {
  const minGradeRaw = searchParams.get("minGrade")?.trim() || null
  if (minGradeRaw && !VALID_GRADES.has(minGradeRaw)) {
    return { error: `Invalid minGrade. Use one of: ${[...VALID_GRADES].join(", ")}` }
  }

  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? RWE_DEFAULT_LIMIT) || RWE_DEFAULT_LIMIT, 1),
    RWE_MAX_LIMIT,
  )

  return {
    params: {
      intervention: searchParams.get("intervention")?.trim() || null,
      biomarker: searchParams.get("biomarker")?.trim() || null,
      minGrade: (minGradeRaw as KgEvidenceGrade | null) ?? null,
      limit,
    },
  }
}

export interface RweQueryResult {
  outcomes: RweOutcomeDto[]
  count: number
  suppressedBelowFloor: number
}

/** Run the population-edge query and shape the result (DB I/O). */
export async function queryRweOutcomes(params: RweQueryParams): Promise<RweQueryResult> {
  const gradeFilter: KgEvidenceGrade[] | undefined = params.minGrade
    ? Object.values(KgEvidenceGrade).filter((g) => gradeMeets(g, params.minGrade as KgEvidenceGrade))
    : undefined

  const where: Prisma.KgEdgeWhereInput = {
    edgeType: KgEdgeType.POPULATION_ASSOCIATION,
    source: RWE_SOURCE,
    ...(gradeFilter ? { evidenceGrade: { in: gradeFilter } } : {}),
    ...(params.intervention
      ? { fromNode: { label: { contains: params.intervention, mode: "insensitive" } } }
      : {}),
    ...(params.biomarker ? { toNode: { label: { contains: params.biomarker, mode: "insensitive" } } } : {}),
  }

  const rows = await db.kgEdge.findMany({
    where,
    take: params.limit,
    orderBy: { createdAt: "desc" },
    select: {
      evidenceGrade: true,
      source: true,
      effectSize: true,
      effectSizeUnit: true,
      confidence: true,
      attributes: true,
      fromNode: { select: { label: true, kind: true, externalId: true } },
      toNode: { select: { label: true, kind: true, externalId: true } },
    },
  })

  const { outcomes, suppressedBelowFloor } = shapeRweOutcomes(rows as RweEdgeRow[])
  return { outcomes, count: outcomes.length, suppressedBelowFloor }
}
