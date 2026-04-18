/**
 * Knowledge-graph queries with typed edges.
 *
 * The relational `KgNode` / `KgEdge` tables encode a directed property
 * graph. These helpers give the discovery agent path-finding and
 * neighborhood lookups without inventing free-text relations.
 */

import { KgEdgeType, KgEvidenceGrade } from "@prisma/client"

import { db } from "@/lib/db"

export interface KgNeighbor {
  edgeId: string
  edgeType: KgEdgeType
  evidenceGrade: KgEvidenceGrade
  source: string
  toNodeId: string
  toLabel: string
  toKind: string
  toExternalId: string
}

const GRADE_RANK: Record<KgEvidenceGrade, number> = {
  A_HIGH: 4,
  B_MODERATE: 3,
  C_LOW: 2,
  D_VERY_LOW: 1,
}

/**
 * Outgoing neighbors of a node, optionally filtered by edge type.
 * Results are sorted by evidence grade (A first) then by edge id for
 * stable pagination.
 */
export async function neighborsOf(
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

/**
 * Bounded breadth-first path search between two nodes.
 *
 * Cap-bounded on purpose: this is a lookup helper, not a graph engine.
 * For path queries past 4 hops, deploy a property-graph backend
 * (Neo4j/Memgraph) and replace this implementation.
 */
export async function shortestEvidencePath(
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
