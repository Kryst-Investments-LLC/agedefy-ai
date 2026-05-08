/**
 * Knowledge-graph queries — public facade.
 *
 * Implementation lives in pluggable backends (see backend.ts). Call
 * sites import from here and stay agnostic of whether the graph is
 * served from Postgres/SQLite or Neo4j. Select the backend with
 * env.KG_BACKEND ("relational" default, "neo4j" optional).
 */

import { KgEdgeType, KgEvidenceGrade } from "@prisma/client"

import { getKgBackend, type KgNeighbor } from "./backend"

export type { KgNeighbor } from "./backend"

export async function neighborsOf(
  nodeId: string,
  options: { edgeTypes?: KgEdgeType[]; minGrade?: KgEvidenceGrade; take?: number } = {},
): Promise<KgNeighbor[]> {
  const backend = await getKgBackend()
  return backend.neighborsOf(nodeId, options)
}

export async function shortestEvidencePath(
  fromNodeId: string,
  toNodeId: string,
  maxDepth = 4,
): Promise<string[] | null> {
  const backend = await getKgBackend()
  return backend.shortestEvidencePath(fromNodeId, toNodeId, maxDepth)
}
