/**
 * Jurisdiction-aware runtime gate.
 *
 * The gate is a technical policy control, not proof or certification of legal
 * compliance. Applicable routes must call it before surfacing governed output.
 *
 * Decisions are recorded in `JurisdictionGateDecision` so the same audit
 * trail used for governance covers the legal layer.
 */

import { db } from "@/lib/db"

export type GateDecision = "ALLOW" | "REDACT" | "BLOCK"

export interface JurisdictionRule {
  jurisdiction: string // ISO-3166 alpha-2 (+ optional region, e.g. "US-CA")
  topic: string // e.g. "rapamycin", "gene_therapy", "ctdna_screening"
  decision: GateDecision
  reason: string
}

export interface JurisdictionRuleSet {
  version: string
  rules: JurisdictionRule[]
}

export interface JurisdictionGateInput {
  tenantId?: string
  sessionId: string
  jurisdiction: string
  topic: string
}

export function evaluateRule(
  ruleSet: JurisdictionRuleSet,
  jurisdiction: string,
  topic: string,
): { decision: GateDecision; reason: string; ruleSetVersion: string } {
  // Most-specific match wins: exact jurisdiction beats country prefix.
  const candidates = ruleSet.rules.filter((r) => r.topic === topic)
  const exact = candidates.find((r) => r.jurisdiction === jurisdiction)
  if (exact) return { decision: exact.decision, reason: exact.reason, ruleSetVersion: ruleSet.version }
  const country = jurisdiction.split("-")[0]
  const countryHit = candidates.find((r) => r.jurisdiction === country)
  if (countryHit) {
    return { decision: countryHit.decision, reason: countryHit.reason, ruleSetVersion: ruleSet.version }
  }
  return {
    decision: "ALLOW",
    reason: `No rule for jurisdiction=${jurisdiction} topic=${topic}; default ALLOW.`,
    ruleSetVersion: ruleSet.version,
  }
}

export async function gateAndRecord(
  ruleSet: JurisdictionRuleSet,
  input: JurisdictionGateInput,
): Promise<{ decision: GateDecision; reason: string }> {
  const result = evaluateRule(ruleSet, input.jurisdiction, input.topic)
  await db.jurisdictionGateDecision.create({
    data: {
      tenantId: input.tenantId ?? "default",
      sessionId: input.sessionId,
      jurisdiction: input.jurisdiction,
      ruleSetVersion: result.ruleSetVersion,
      decision: result.decision,
      reason: result.reason,
    },
  })
  return { decision: result.decision, reason: result.reason }
}
