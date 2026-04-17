/**
 * Unified Longitudinal Data Graph
 *
 * Aggregates all user-facing health data across product surfaces into a
 * single chronological timeline. Each entry carries provenance, uncertainty,
 * and review-state metadata so consumers can assess trustworthiness at the
 * point of display.
 *
 * @module lib/graph/longitudinal-graph
 */

import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/*  Shared graph-node types                                           */
/* ------------------------------------------------------------------ */

export type GraphNodeDomain =
  | 'biomarker'
  | 'protocol'
  | 'outcome'
  | 'lab-result'
  | 'consultation'
  | 'evidence'
  | 'hypothesis'
  | 'trial-match'
  | 'discovery'
  | 'marketplace-order'
  | 'adverse-event'
  | 'partner-data'

export interface ProvenanceMetadata {
  source: string
  sourceType: 'manual' | 'automated' | 'ai-generated' | 'imported' | 'partner'
  uncertaintyScore: number
  reviewStatus: 'unreviewed' | 'in-review' | 'verified' | 'rejected'
  reviewedAt?: string
  reviewedBy?: string
}

export interface GraphNode {
  id: string
  domain: GraphNodeDomain
  title: string
  summary: string
  occurredAt: string
  createdAt: string
  entityId: string
  provenance: ProvenanceMetadata
  /** Optional linked entity IDs across domains */
  linkedEntityIds: Record<string, string[]>
  /** Domain-specific payload (truncated for timeline views) */
  payload: Record<string, unknown>
}

export interface LongitudinalGraph {
  userId: string
  nodeCount: number
  nodes: GraphNode[]
  generatedAt: string
}

/* ------------------------------------------------------------------ */
/*  Domain-specific node builders                                     */
/* ------------------------------------------------------------------ */

function buildBiomarkerNodes(
  biomarkers: Awaited<ReturnType<typeof fetchBiomarkers>>,
): GraphNode[] {
  return biomarkers.map((b) => ({
    id: `biomarker:${b.id}`,
    domain: 'biomarker' as const,
    title: `${b.name}: ${b.value} ${b.unit}`,
    summary: `Biomarker measurement — ${b.trend} trend${b.target ? `, target ${b.target}` : ''}`,
    occurredAt: b.measuredAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
    entityId: b.id,
    provenance: {
      source: 'user-entry',
      sourceType: 'manual',
      uncertaintyScore: 0.1,
      reviewStatus: 'unreviewed',
    },
    linkedEntityIds: {
      ...(b.protocolId ? { protocol: [b.protocolId] } : {}),
    },
    payload: { name: b.name, value: b.value, unit: b.unit, trend: b.trend, target: b.target },
  }))
}

function buildProtocolNodes(
  protocols: Awaited<ReturnType<typeof fetchProtocols>>,
): GraphNode[] {
  return protocols.map((p) => ({
    id: `protocol:${p.id}`,
    domain: 'protocol' as const,
    title: p.name,
    summary: `Protocol — ${p.status}${p.contraindicationScore != null ? ` (safety: ${(1 - p.contraindicationScore).toFixed(2)})` : ''}`,
    occurredAt: p.createdAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    entityId: p.id,
    provenance: {
      source: 'user-created',
      sourceType: 'manual',
      uncertaintyScore: p.contraindicationScore ?? 0.3,
      reviewStatus: 'unreviewed',
    },
    linkedEntityIds: {},
    payload: { name: p.name, status: p.status, contraindicationScore: p.contraindicationScore },
  }))
}

function buildOutcomeNodes(
  outcomes: Awaited<ReturnType<typeof fetchOutcomes>>,
): GraphNode[] {
  return outcomes.map((o) => ({
    id: `outcome:${o.id}`,
    domain: 'outcome' as const,
    title: `${o.biomarkerName}: ${o.baselineValue} → ${o.latestValue}`,
    summary: `Intervention outcome — delta ${o.delta > 0 ? '+' : ''}${o.delta.toFixed(2)} (confidence: ${(o.confidenceScore * 100).toFixed(0)}%)`,
    occurredAt: o.observedAt.toISOString(),
    createdAt: o.createdAt.toISOString(),
    entityId: o.id,
    provenance: {
      source: 'outcome-tracking',
      sourceType: 'manual',
      uncertaintyScore: 1 - o.confidenceScore,
      reviewStatus: 'unreviewed',
    },
    linkedEntityIds: {
      ...(o.protocolId ? { protocol: [o.protocolId] } : {}),
    },
    payload: { biomarkerName: o.biomarkerName, baseline: o.baselineValue, latest: o.latestValue, delta: o.delta, confidence: o.confidenceScore },
  }))
}

function buildLabResultNodes(
  labOrders: Awaited<ReturnType<typeof fetchLabOrders>>,
): GraphNode[] {
  const nodes: GraphNode[] = []
  for (const order of labOrders) {
    for (const result of order.results) {
      nodes.push({
        id: `lab-result:${result.id}`,
        domain: 'lab-result',
        title: `${result.biomarkerName}: ${result.value} ${result.unit}`,
        summary: `Lab result from ${order.panel.name}${result.flag ? ` (${result.flag})` : ''}`,
        occurredAt: result.createdAt.toISOString(),
        createdAt: result.createdAt.toISOString(),
        entityId: result.id,
        provenance: {
          source: `lab:${order.panel.name}`,
          sourceType: 'imported',
          uncertaintyScore: 0.05,
          reviewStatus: order.status === 'COMPLETED' ? 'verified' : 'unreviewed',
          ...(order.completedAt ? { reviewedAt: order.completedAt.toISOString() } : {}),
        },
        linkedEntityIds: {
          labOrder: [order.id],
          ...(result.protocolId ? { protocol: [result.protocolId] } : {}),
        },
        payload: { biomarkerName: result.biomarkerName, value: result.value, unit: result.unit, refLow: result.refLow, refHigh: result.refHigh, flag: result.flag },
      })
    }
  }
  return nodes
}

function buildConsultationNodes(
  consultations: Awaited<ReturnType<typeof fetchConsultations>>,
): GraphNode[] {
  return consultations.map((c) => ({
    id: `consultation:${c.id}`,
    domain: 'consultation' as const,
    title: `${c.type} consultation — ${c.status}`,
    summary: c.reason,
    occurredAt: (c.scheduledAt ?? c.createdAt).toISOString(),
    createdAt: c.createdAt.toISOString(),
    entityId: c.id,
    provenance: {
      source: 'telemedicine',
      sourceType: 'manual',
      uncertaintyScore: 0,
      reviewStatus: c.status === 'COMPLETED' ? 'verified' : 'unreviewed',
      ...(c.completedAt ? { reviewedAt: c.completedAt.toISOString() } : {}),
    },
    linkedEntityIds: {},
    payload: { type: c.type, status: c.status, reason: c.reason, summary: c.summary },
  }))
}

function buildEvidenceNodes(
  evidence: Awaited<ReturnType<typeof fetchEvidence>>,
): GraphNode[] {
  return evidence.map((e) => ({
    id: `evidence:${e.id}`,
    domain: 'evidence' as const,
    title: e.title,
    summary: `${e.studyType} — ${e.evidenceDirection} (score: ${e.evidenceScore.toFixed(2)})`,
    occurredAt: (e.sourceCapturedAt ?? e.createdAt).toISOString(),
    createdAt: e.createdAt.toISOString(),
    entityId: e.id,
    provenance: {
      source: e.sourceLabel,
      sourceType: e.provenanceType === 'AI_EXTRACTED' ? 'ai-generated' : e.provenanceType === 'PUBMED_IMPORT' || e.provenanceType === 'CLINICAL_TRIAL_IMPORT' ? 'imported' : 'manual',
      uncertaintyScore: e.uncertaintyScore,
      reviewStatus: e.reviewStatus === 'VERIFIED' ? 'verified' : e.reviewStatus === 'REJECTED' ? 'rejected' : e.reviewStatus === 'IN_REVIEW' || e.reviewStatus === 'ESCALATED' ? 'in-review' : 'unreviewed',
      ...(e.reviewedAt ? { reviewedAt: e.reviewedAt.toISOString() } : {}),
      ...(e.reviewedByUserId ? { reviewedBy: e.reviewedByUserId } : {}),
    },
    linkedEntityIds: {
      ...(e.researchEntryId ? { researchEntry: [e.researchEntryId] } : {}),
    },
    payload: { studyType: e.studyType, direction: e.evidenceDirection, score: e.evidenceScore, diseaseArea: e.diseaseArea },
  }))
}

function buildHypothesisNodes(
  hypotheses: Awaited<ReturnType<typeof fetchHypotheses>>,
): GraphNode[] {
  return hypotheses.map((h) => ({
    id: `hypothesis:${h.id}`,
    domain: 'hypothesis' as const,
    title: h.title,
    summary: `Hypothesis — ${h.status} (priority: ${h.priorityScore.toFixed(2)}, confidence: ${h.confidenceScore.toFixed(2)})`,
    occurredAt: h.createdAt.toISOString(),
    createdAt: h.createdAt.toISOString(),
    entityId: h.id,
    provenance: {
      source: 'hypothesis-engine',
      sourceType: 'manual',
      uncertaintyScore: h.uncertaintyScore,
      reviewStatus: h.status === 'VALIDATED' ? 'verified' : h.status === 'REJECTED' ? 'rejected' : h.status === 'IN_REVIEW' ? 'in-review' : 'unreviewed',
    },
    linkedEntityIds: {},
    payload: { question: h.question, status: h.status, priorityScore: h.priorityScore, confidenceScore: h.confidenceScore },
  }))
}

function buildDiscoveryNodes(
  candidates: Awaited<ReturnType<typeof fetchDiscoveries>>,
): GraphNode[] {
  return candidates.map((c) => ({
    id: `discovery:${c.id}`,
    domain: 'discovery' as const,
    title: `ÆonForge Discovery — ${c.status}`,
    summary: c.prompt.slice(0, 120),
    occurredAt: c.createdAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    entityId: c.id,
    provenance: {
      source: 'aeonforge',
      sourceType: 'ai-generated',
      uncertaintyScore: 1 - (c.simulationScore ?? 0.5),
      reviewStatus: c.status === 'approved' ? 'verified' : c.status === 'rejected' ? 'rejected' : 'unreviewed',
    },
    linkedEntityIds: {},
    payload: { prompt: c.prompt, simulationScore: c.simulationScore, safetyScore: c.safetyScore, healthspanDelta: c.healthspanDelta },
  }))
}

function buildMarketplaceOrderNodes(
  orders: Awaited<ReturnType<typeof fetchMarketplaceOrders>>,
): GraphNode[] {
  return orders.map((o) => ({
    id: `marketplace-order:${o.id}`,
    domain: 'marketplace-order' as const,
    title: `Order — ${o.status}`,
    summary: `$${(o.totalCents / 100).toFixed(2)} ${o.currency} — ${o.items.length} item(s)`,
    occurredAt: o.orderedAt.toISOString(),
    createdAt: o.createdAt.toISOString(),
    entityId: o.id,
    provenance: {
      source: 'marketplace',
      sourceType: 'automated',
      uncertaintyScore: 0,
      reviewStatus: o.status === 'DELIVERED' ? 'verified' as const : 'unreviewed' as const,
    },
    linkedEntityIds: {},
    payload: { status: o.status, totalCents: o.totalCents, itemCount: o.items.length },
  }))
}

function buildAdverseEventNodes(
  events: Awaited<ReturnType<typeof fetchAdverseEvents>>,
): GraphNode[] {
  return events.map((ae) => ({
    id: `adverse-event:${ae.id}`,
    domain: 'adverse-event' as const,
    title: `Adverse Event — ${ae.severity} (${ae.category})`,
    summary: ae.suspectedCause ?? 'Unknown cause',
    occurredAt: (ae.onsetAt ?? ae.createdAt).toISOString(),
    createdAt: ae.createdAt.toISOString(),
    entityId: ae.id,
    provenance: {
      source: ae.detectedBy,
      sourceType: ae.detectedBy === 'ai' ? 'ai-generated' : 'manual',
      uncertaintyScore: 0.3,
      reviewStatus: ae.escalationRequired ? 'in-review' : 'unreviewed',
    },
    linkedEntityIds: {
      ...(ae.protocolId ? { protocol: [ae.protocolId] } : {}),
    },
    payload: { severity: ae.severity, seriousness: ae.seriousness, category: ae.category, outcome: ae.outcome },
  }))
}

/* ------------------------------------------------------------------ */
/*  Data fetchers (user-scoped)                                       */
/* ------------------------------------------------------------------ */

function fetchBiomarkers(userId: string, limit: number) {
  return db.biomarker.findMany({ where: { userId }, orderBy: { measuredAt: 'desc' }, take: limit })
}

function fetchProtocols(userId: string, limit: number) {
  return db.protocol.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit })
}

function fetchOutcomes(userId: string, limit: number) {
  return db.interventionOutcome.findMany({ where: { userId }, orderBy: { observedAt: 'desc' }, take: limit })
}

function fetchLabOrders(userId: string, limit: number) {
  return db.labOrder.findMany({
    where: { userId },
    orderBy: { orderedAt: 'desc' },
    take: limit,
    include: { results: true, panel: { select: { name: true } } },
  })
}

function fetchConsultations(userId: string, limit: number) {
  return db.consultationRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit })
}

function fetchEvidence(userId: string, limit: number) {
  return db.evidenceRecord.findMany({ where: { createdByUserId: userId }, orderBy: { createdAt: 'desc' }, take: limit })
}

function fetchHypotheses(userId: string, limit: number) {
  return db.hypothesis.findMany({ where: { ownerUserId: userId }, orderBy: { createdAt: 'desc' }, take: limit })
}

function fetchDiscoveries(userId: string, limit: number) {
  return db.aeonForgeCandidate.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit })
}

function fetchMarketplaceOrders(userId: string, limit: number) {
  return db.marketplaceOrder.findMany({
    where: { userId },
    orderBy: { orderedAt: 'desc' },
    take: limit,
    include: { items: { select: { id: true } } },
  })
}

function fetchAdverseEvents(userId: string, limit: number) {
  return db.adverseEventReport.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit })
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export interface BuildGraphOptions {
  /** Max nodes per domain (default 50) */
  limitPerDomain?: number
  /** Filter to specific domains */
  domains?: GraphNodeDomain[]
}

/**
 * Build a unified longitudinal graph for a user, spanning all product surfaces.
 * Nodes are sorted chronologically (newest first) with provenance metadata.
 */
export async function buildLongitudinalGraph(
  userId: string,
  options: BuildGraphOptions = {},
): Promise<LongitudinalGraph> {
  const limit = options.limitPerDomain ?? 50
  const include = options.domains ?? undefined

  const fetchers: Array<{ domain: GraphNodeDomain; fetch: () => Promise<GraphNode[]> }> = [
    { domain: 'biomarker', fetch: async () => buildBiomarkerNodes(await fetchBiomarkers(userId, limit)) },
    { domain: 'protocol', fetch: async () => buildProtocolNodes(await fetchProtocols(userId, limit)) },
    { domain: 'outcome', fetch: async () => buildOutcomeNodes(await fetchOutcomes(userId, limit)) },
    { domain: 'lab-result', fetch: async () => buildLabResultNodes(await fetchLabOrders(userId, limit)) },
    { domain: 'consultation', fetch: async () => buildConsultationNodes(await fetchConsultations(userId, limit)) },
    { domain: 'evidence', fetch: async () => buildEvidenceNodes(await fetchEvidence(userId, limit)) },
    { domain: 'hypothesis', fetch: async () => buildHypothesisNodes(await fetchHypotheses(userId, limit)) },
    { domain: 'discovery', fetch: async () => buildDiscoveryNodes(await fetchDiscoveries(userId, limit)) },
    { domain: 'marketplace-order', fetch: async () => buildMarketplaceOrderNodes(await fetchMarketplaceOrders(userId, limit)) },
    { domain: 'adverse-event', fetch: async () => buildAdverseEventNodes(await fetchAdverseEvents(userId, limit)) },
  ]

  const activeFetchers = include
    ? fetchers.filter((f) => include.includes(f.domain))
    : fetchers

  const results = await Promise.all(activeFetchers.map((f) => f.fetch()))
  const allNodes = results.flat().sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())

  return {
    userId,
    nodeCount: allNodes.length,
    nodes: allNodes,
    generatedAt: new Date().toISOString(),
  }
}
