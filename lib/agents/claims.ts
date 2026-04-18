/**
 * Agent claim provenance.
 *
 * Every recommendation an agent surfaces to a clinician must be backed by
 * one of: a mechanistic simulation run, a graded knowledge-graph edge, a
 * cohort statistic, an N-of-1 result, or a regulatory label section.
 * `recordClaim` persists that linkage. `requireCitation` guards a result
 * before it leaves the agent boundary.
 */

import { AgentClaimEvidenceKind } from "@prisma/client"

import { db } from "@/lib/db"

export interface AgentClaimInput {
  tenantId?: string
  sessionId: string
  agentClass: "discovery" | "protocol" | "safety" | "explainability" | "perception"
  claimText: string
  evidenceKind: AgentClaimEvidenceKind
  evidenceRef: string
  confidence: number // 0..1
}

export class MissingCitationError extends Error {
  constructor(agentClass: string, claimText: string) {
    super(
      `Agent "${agentClass}" attempted to surface a claim without citation: ${claimText.slice(0, 120)}`,
    )
    this.name = "MissingCitationError"
  }
}

export async function recordClaim(input: AgentClaimInput): Promise<string> {
  const confidence = Math.max(0, Math.min(1, input.confidence))
  const row = await db.agentClaim.create({
    data: {
      tenantId: input.tenantId ?? "default",
      sessionId: input.sessionId,
      agentClass: input.agentClass,
      claimText: input.claimText,
      evidenceKind: input.evidenceKind,
      evidenceRef: input.evidenceRef,
      confidence,
    },
    select: { id: true },
  })
  return row.id
}

/**
 * Throws if the supplied list of claims is empty. Use at the boundary of
 * any agent that produces user-visible recommendations.
 */
export function requireCitation(
  agentClass: string,
  claims: AgentClaimInput[],
): void {
  if (!claims.length) {
    throw new MissingCitationError(agentClass, "<no claims emitted>")
  }
  for (const c of claims) {
    if (!c.evidenceRef || !c.evidenceKind) {
      throw new MissingCitationError(agentClass, c.claimText)
    }
  }
}
