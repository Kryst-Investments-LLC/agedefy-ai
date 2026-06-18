/**
 * RWE Edge Materializer — DB executor (Flywheel → Knowledge Graph)
 *
 * Standalone, re-runnable job that reads de-identified AggregateOutcome rows
 * for a period and projects them into the knowledge graph as population
 * association edges. Pure mapping + grading + node identity live in
 * `causal-edge-materializer.ts` / `node-identity.ts`; this file only does I/O.
 *
 * Idempotency: there is at most one current RWE edge per
 * (intervention, outcome) pair. Re-materialising a pair replaces its edge, so
 * re-running the same or a newer period overwrites rather than duplicates.
 *
 * @module lib/flywheel/materialize-rwe-edges
 */

import { KgEdgeType } from "@prisma/client"

import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

import {
  planRweMaterialization,
  RWE_SOURCE,
  type AggregateOutcomeRow,
  type CompoundIdentity,
  type RweEdgeInput,
} from "./causal-edge-materializer"

export interface MaterializeRweResult {
  period: string
  tenantId: string
  scanned: number
  suppressed: number
  skippedNoCompound: number
  edgesUpserted: number
  runAt: string
}

/** Upsert a KgNode by its canonical (tenantId, kind, externalId) identity. */
async function upsertNode(
  tenantId: string,
  kind: string,
  externalId: string,
  label: string,
): Promise<string> {
  const node = await db.kgNode.upsert({
    where: { tenantId_kind_externalId: { tenantId, kind, externalId } },
    create: { tenantId, kind, externalId, label },
    update: { label },
    select: { id: true },
  })
  return node.id
}

/** Replace any prior RWE edge between a pair, then create the current one. */
async function replaceEdge(
  tenantId: string,
  fromNodeId: string,
  toNodeId: string,
  edge: RweEdgeInput,
): Promise<void> {
  await db.kgEdge.deleteMany({
    where: {
      fromNodeId,
      toNodeId,
      edgeType: KgEdgeType.POPULATION_ASSOCIATION,
      source: RWE_SOURCE,
    },
  })
  await db.kgEdge.create({
    data: {
      tenantId,
      fromNodeId,
      toNodeId,
      edgeType: edge.edgeType,
      evidenceGrade: edge.evidenceGrade,
      source: edge.source,
      pubmedIds: edge.pubmedIds,
      effectSize: edge.effectSize,
      effectSizeUnit: edge.effectSizeUnit,
      confidence: edge.confidence,
      attributes: edge.attributes,
    },
  })
}

/**
 * Materialise RWE edges for a given period.
 *
 * @param period   AggregateOutcome.period label to project (e.g. "2026-Q2").
 * @param tenantId Tenant scope (default "default").
 */
export async function materializeRweEdges(
  period: string,
  tenantId = "default",
): Promise<MaterializeRweResult> {
  logger.info("Materialising RWE edges", { period, tenantId })

  // 1. Load compound-branch aggregate rows for the period.
  const aggregates = await db.aggregateOutcome.findMany({
    where: { tenantId, period, cohortBucket: { startsWith: "biomarker:" } },
    select: {
      compoundId: true,
      cohortBucket: true,
      sampleSize: true,
      meanOutcomeScore: true,
      stdDev: true,
      pValue: true,
      confidence: true,
      period: true,
    },
  })

  // 2. Resolve the compounds referenced by those rows.
  const compoundIds = [...new Set(aggregates.map((a) => a.compoundId).filter((id): id is string => !!id))]
  const compounds = compoundIds.length
    ? await db.compound.findMany({
        where: { id: { in: compoundIds } },
        select: { id: true, name: true, casNumber: true, pubChemCid: true },
      })
    : []
  const compoundsById = new Map<string, CompoundIdentity>(
    compounds.map((c) => [c.id, { name: c.name, casNumber: c.casNumber, pubChemCid: c.pubChemCid }]),
  )

  // 3. Plan (pure) — resolve identities, grade, suppress below floor.
  const plan = planRweMaterialization({
    tenantId,
    aggregates: aggregates as AggregateOutcomeRow[],
    compoundsById,
  })

  // 4. Execute the plan — upsert nodes + replace edges.
  let edgesUpserted = 0
  for (const edge of plan.edges) {
    const fromNodeId = await upsertNode(tenantId, edge.fromKind, edge.fromExternalId, edge.fromLabel)
    const toNodeId = await upsertNode(tenantId, edge.toKind, edge.toExternalId, edge.toLabel)
    await replaceEdge(tenantId, fromNodeId, toNodeId, edge)
    edgesUpserted++
  }

  const result: MaterializeRweResult = {
    period,
    tenantId,
    scanned: plan.scanned,
    suppressed: plan.suppressed,
    skippedNoCompound: plan.skippedNoCompound,
    edgesUpserted,
    runAt: new Date().toISOString(),
  }
  logger.info("RWE edge materialisation complete", { ...result })
  return result
}
