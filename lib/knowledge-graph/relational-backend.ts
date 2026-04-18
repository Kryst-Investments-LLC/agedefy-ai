/**
 * Relational implementation of KgBackend, backed by Prisma KgNode/KgEdge.
 * This is the default for dev and small/medium graphs. For graphs that
 * grow past ~10^5 edges or that need real multi-hop traversals, switch
 * to the neo4j backend.
 */

import { KgEdgeType, KgEvidenceGrade } from "@prisma/client"

import { db } from "@/lib/db"

import type { KgBackend, KgNeighbor } from "./backend"

const GRADE_RANK: Record<KgEvidenceGrade, number> = {
  A_HIGH: 4,
  B_MODERATE: 3,
  C_LOW: 2,
  D_VERY_LOW: 1,
}

async function neighborsOf(
  nodeId: string,
  options: { edgeTypes?: KgEdgeType[]; minGrade?: KgEvidenceGrade; take?: number } = {},
): Promise<KgNeighbor[]> {
  const minRank = options.minGrade ? GRADE_RANK[options.minGrade] : 0
  const edges = await db.kgEdge.findMany({
    where: {
      fromNodeId: nodeId,
      ...(options.edgeTypes ? { edgeType: { in: options.edgeTypes } } : {}),
    },
    take: options.take ?? 200,
    include: {
      toNode: {
        select: { id: true, label: true, kind: true, externalId: true },
      },
    },
  })
  return edges
    .filter((e) => GRADE_RANK[e.evidenceGrade] >= minRank)
    .sort((a, b) => GRADE_RANK[b.evidenceGrade] - GRADE_RANK[a.evidenceGrade])
    .map((e) => ({
      edgeId: e.id,
      edgeType: e.edgeType,
      evidenceGrade: e.evidenceGrade,
      source: e.source,
      toNodeId: e.toNode.id,
      toLabel: e.toNode.label,
      toKind: e.toNode.kind,
      toExternalId: e.toNode.externalId,
    }))
}

async function shortestEvidencePath(
  fromNodeId: string,
  toNodeId: string,
  maxDepth = 4,
): Promise<string[] | null> {
  if (fromNodeId === toNodeId) return [fromNodeId]
  const visited = new Set<string>([fromNodeId])
  const queue: Array<{ nodeId: string; path: string[] }> = [
    { nodeId: fromNodeId, path: [fromNodeId] },
  ]
  while (queue.length) {
    const { nodeId, path } = queue.shift()!
    if (path.length > maxDepth) continue
    const neighbors = await neighborsOf(nodeId, { take: 50 })
    for (const n of neighbors) {
      if (n.toNodeId === toNodeId) return [...path, n.toNodeId]
      if (!visited.has(n.toNodeId)) {
        visited.add(n.toNodeId)
        queue.push({ nodeId: n.toNodeId, path: [...path, n.toNodeId] })
      }
    }
  }
  return null
}

export function createRelationalBackend(): KgBackend {
  return {
    name: "relational",
    neighborsOf,
    shortestEvidencePath,
  }
}
