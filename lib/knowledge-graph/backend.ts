/**
 * Knowledge-graph backend interface.
 *
 * The relational implementation in `relational-backend.ts` is the
 * default and ships in-tree. Production deployments that need real
 * multi-hop path queries should set `KG_BACKEND=neo4j` and implement
 * the stub in `neo4j-backend.ts` against their cluster.
 *
 * The interface is deliberately small so a future Memgraph or
 * TigerGraph adapter can be added without changing call sites.
 */

import { KgEdgeType, KgEvidenceGrade } from "@prisma/client"

import { env } from "@/lib/env"

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

export interface KgBackend {
  /** Backend identifier, e.g. "relational" or "neo4j". */
  readonly name: string
  neighborsOf(
    nodeId: string,
    options?: {
      edgeTypes?: KgEdgeType[]
      minGrade?: KgEvidenceGrade
      take?: number
    },
  ): Promise<KgNeighbor[]>
  shortestEvidencePath(
    fromNodeId: string,
    toNodeId: string,
    maxDepth?: number,
  ): Promise<string[] | null>
}

let cached: KgBackend | null = null

/**
 * Lazily resolves the active KG backend. The relational backend is
 * always available; the neo4j backend is loaded behind a dynamic
 * import so the neo4j driver is not a hard dependency for deployments
 * that don't need it.
 */
export async function getKgBackend(): Promise<KgBackend> {
  if (cached) return cached
  const choice = env.KG_BACKEND ?? "relational"
  if (choice === "neo4j") {
    // Feature flag gate — ENABLE_NEO4J_BACKEND defaults OFF; KG_BACKEND=neo4j alone is not enough
    if (env.ENABLE_NEO4J_BACKEND !== 'true') {
      const mod = await import("./relational-backend")
      cached = mod.createRelationalBackend()
      return cached
    }
    const mod = await import("./neo4j-backend")
    cached = mod.createNeo4jBackend()
    return cached
  }
  const mod = await import("./relational-backend")
  cached = mod.createRelationalBackend()
  return cached
}

/** Test hook. */
export function __resetKgBackendCacheForTests(): void {
  cached = null
}
