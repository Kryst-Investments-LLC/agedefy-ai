/**
 * Stub Neo4j backend.
 *
 * Selected when env.KG_BACKEND === "neo4j". This file deliberately does
 * NOT import the neo4j-driver — adding the dependency is a deployment
 * decision, not a code-base default. To enable:
 *
 *   1. pnpm add neo4j-driver
 *   2. Set KG_NEO4J_URL, KG_NEO4J_USER, KG_NEO4J_PASSWORD.
 *   3. Replace the throws below with real driver calls. Cypher
 *      sketches are inlined as comments.
 *
 * Until then, attempting to use this backend at runtime fails loudly so
 * the operator notices the misconfiguration immediately rather than
 * silently degrading to empty graph results.
 */

import type { KgBackend, KgNeighbor } from "./backend"
import { env } from "@/lib/env"

function notConfigured(method: string): never {
  throw new Error(
    `[kg/neo4j] ${method} called but the Neo4j backend is not implemented in this build. ` +
      `Install neo4j-driver, set KG_NEO4J_URL/USER/PASSWORD, and provide an implementation in lib/knowledge-graph/neo4j-backend.ts.`,
  )
}

export function createNeo4jBackend(): KgBackend {
  if (!env.KG_NEO4J_URL) {
    throw new Error(
      "[kg/neo4j] KG_BACKEND=neo4j but KG_NEO4J_URL is not set. Refusing to start with a half-configured graph backend.",
    )
  }

  // Cypher sketches for the eventual implementation:
  //
  //   neighborsOf(nodeId, {edgeTypes, minGrade, take}):
  //     MATCH (n {id: $nodeId})-[r]->(m)
  //     WHERE ($edgeTypes IS NULL OR type(r) IN $edgeTypes)
  //       AND ($minRank IS NULL OR r.gradeRank >= $minRank)
  //     RETURN r, m
  //     ORDER BY r.gradeRank DESC
  //     LIMIT $take
  //
  //   shortestEvidencePath(from, to, maxDepth):
  //     MATCH path = shortestPath((a {id:$from})-[*..$maxDepth]->(b {id:$to}))
  //     RETURN [n IN nodes(path) | n.id]

  return {
    name: "neo4j",
    async neighborsOf(_nodeId, _options): Promise<KgNeighbor[]> {
      notConfigured("neighborsOf")
    },
    async shortestEvidencePath(_from, _to, _maxDepth): Promise<string[] | null> {
      notConfigured("shortestEvidencePath")
    },
  }
}
