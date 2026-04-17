import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  biomarkerFindMany: vi.fn().mockResolvedValue([]),
  protocolFindMany: vi.fn().mockResolvedValue([]),
  outcomeFindMany: vi.fn().mockResolvedValue([]),
  labOrderFindMany: vi.fn().mockResolvedValue([]),
  consultationFindMany: vi.fn().mockResolvedValue([]),
  evidenceFindMany: vi.fn().mockResolvedValue([]),
  hypothesisFindMany: vi.fn().mockResolvedValue([]),
  candidateFindMany: vi.fn().mockResolvedValue([]),
  orderFindMany: vi.fn().mockResolvedValue([]),
  adverseEventFindMany: vi.fn().mockResolvedValue([]),
  evidenceUpdate: vi.fn().mockResolvedValue({}),
  clinicianTaskFindMany: vi.fn().mockResolvedValue([]),
  clinicianTaskUpdate: vi.fn().mockResolvedValue({}),
  discoveryFindMany: vi.fn().mockResolvedValue([]),
  discoveryUpdate: vi.fn().mockResolvedValue({}),
  modelConfFindMany: vi.fn().mockResolvedValue([]),
  scientistFindUnique: vi.fn().mockResolvedValue(null),
  sponsorFindUnique: vi.fn().mockResolvedValue(null),
  userFindUnique: vi.fn().mockResolvedValue(null),
  scientistUpdate: vi.fn().mockResolvedValue({}),
  biomarkerCount: vi.fn().mockResolvedValue(0),
  protocolCount: vi.fn().mockResolvedValue(0),
  adverseEventCount: vi.fn().mockResolvedValue(0),
  evidenceCount: vi.fn().mockResolvedValue(0),
  clinicianTaskCount: vi.fn().mockResolvedValue(0),
  discoveryCount: vi.fn().mockResolvedValue(0),
  dealRoomCount: vi.fn().mockResolvedValue(0),
  userCount: vi.fn().mockResolvedValue(0),
  fundingRequestFindMany: vi.fn().mockResolvedValue([]),
  fundingRequestCreate: vi.fn(),
  fundingRequestFindUnique: vi.fn().mockResolvedValue(null),
  fundingRequestUpdate: vi.fn(),
  discoveryFindUnique: vi.fn().mockResolvedValue(null),
  evidenceFindUnique: vi.fn().mockResolvedValue(null),
  hypothesisFindUnique: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/db', () => ({
  db: {
    biomarker: { findMany: mocks.biomarkerFindMany, count: mocks.biomarkerCount },
    protocol: { findMany: mocks.protocolFindMany, count: mocks.protocolCount },
    interventionOutcome: { findMany: mocks.outcomeFindMany },
    labOrder: { findMany: mocks.labOrderFindMany },
    consultationRequest: { findMany: mocks.consultationFindMany, count: vi.fn().mockResolvedValue(0) },
    evidenceRecord: { findMany: mocks.evidenceFindMany, count: mocks.evidenceCount, update: mocks.evidenceUpdate, findUnique: mocks.evidenceFindUnique },
    hypothesis: { findMany: mocks.hypothesisFindMany, findUnique: mocks.hypothesisFindUnique },
    aeonForgeCandidate: { findMany: mocks.candidateFindMany },
    marketplaceOrder: { findMany: mocks.orderFindMany },
    adverseEventReport: { findMany: mocks.adverseEventFindMany, count: mocks.adverseEventCount },
    clinicianTask: { findMany: mocks.clinicianTaskFindMany, update: mocks.clinicianTaskUpdate, count: mocks.clinicianTaskCount },
    marketplaceDiscovery: { findMany: mocks.discoveryFindMany, update: mocks.discoveryUpdate, findUnique: mocks.discoveryFindUnique, count: mocks.discoveryCount },
    marketplaceScientist: { findUnique: mocks.scientistFindUnique, update: mocks.scientistUpdate },
    marketplaceSponsor: { findUnique: mocks.sponsorFindUnique },
    marketplaceFundingRequest: { findMany: mocks.fundingRequestFindMany, create: mocks.fundingRequestCreate, findUnique: mocks.fundingRequestFindUnique, update: mocks.fundingRequestUpdate },
    modelConfidenceScore: { findMany: mocks.modelConfFindMany },
    marketplaceDealRoom: { count: mocks.dealRoomCount },
    user: { findUnique: mocks.userFindUnique, count: mocks.userCount },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { buildLongitudinalGraph, type GraphNode } from '@/lib/graph/longitudinal-graph'
import { getProvenanceSnapshots } from '@/lib/graph/provenance'
import { getReviewQueue, submitReviewDecision } from '@/lib/graph/reviewer-workflow'
import { computeScientistTrust, computeSponsorTrust, computeReviewerTrust } from '@/lib/trust/trust-engine'
import { computeOutcomeFeedbackScore } from '@/lib/loop/outcome-scoring'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date()
const uid = 'usr-test'

function makeBiomarker(id: string, name: string, value: number) {
  return { id, userId: uid, name, value, unit: 'ng/mL', trend: 'improving', target: 100, measuredAt: now, createdAt: now, protocolId: null }
}

function makeEvidence(id: string, title: string, overrides: Record<string, unknown> = {}) {
  return {
    id, title, studyType: 'RCT', evidenceDirection: 'supports', evidenceScore: 0.85,
    uncertaintyScore: 0.15, reviewStatus: 'PENDING', provenanceType: 'PUBMED_IMPORT',
    sourceLabel: 'PubMed', createdByUserId: uid, createdAt: now,
    sourceCapturedAt: null, reviewedAt: null, reviewedByUserId: null,
    researchEntryId: null, diseaseArea: 'Aging', reviewConfidence: null,
    ...overrides,
  }
}

function makeProtocol(id: string, name: string, status = 'active') {
  return { id, userId: uid, name, status, createdAt: now, contraindicationScore: 0.1 }
}

function makeOutcome(id: string) {
  return { id, userId: uid, biomarkerName: 'CRP', baselineValue: 5, latestValue: 3, delta: -2, confidenceScore: 0.8, observedAt: now, createdAt: now, protocolId: `proto-${id}` }
}

function makeCandidate(id: string, status = 'pending') {
  return { id, userId: uid, prompt: 'Test discovery prompt for testing', status, simulationScore: 0.7, safetyScore: 0.9, healthspanDelta: 2.1, createdAt: now }
}

function makeClinicianTask(id: string, status = 'OPEN') {
  return { id, title: `Task ${id}`, description: 'Some task', status, category: 'SAFETY_ALERT', patientUserId: uid, clinicianUserId: 'clinician-1', createdAt: now }
}

function makeDiscovery(id: string, status = 'SUBMITTED') {
  return { id, scientistId: 'sci-1', title: `Discovery ${id}`, description: 'Test', status, category: 'Longevity', diseaseArea: 'Aging', createdAt: now }
}

// ---------------------------------------------------------------------------
// P3.1 — Longitudinal Graph
// ---------------------------------------------------------------------------

describe('P3.1 — Longitudinal Graph', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('builds empty graph for user with no data', async () => {
    const graph = await buildLongitudinalGraph(uid)
    expect(graph.userId).toBe(uid)
    expect(graph.nodeCount).toBe(0)
    expect(graph.nodes).toEqual([])
  })

  it('aggregates biomarkers and protocols into nodes', async () => {
    mocks.biomarkerFindMany.mockResolvedValueOnce([makeBiomarker('b1', 'CRP', 3.2)])
    mocks.protocolFindMany.mockResolvedValueOnce([makeProtocol('p1', 'Rapamycin')])

    const graph = await buildLongitudinalGraph(uid)
    expect(graph.nodeCount).toBe(2)
    expect(graph.nodes.map((n: GraphNode) => n.domain)).toContain('biomarker')
    expect(graph.nodes.map((n: GraphNode) => n.domain)).toContain('protocol')
  })

  it('includes provenance metadata on every node', async () => {
    mocks.biomarkerFindMany.mockResolvedValueOnce([makeBiomarker('b1', 'CRP', 3.2)])

    const graph = await buildLongitudinalGraph(uid)
    const node = graph.nodes[0]
    expect(node.provenance).toBeDefined()
    expect(node.provenance).toHaveProperty('source')
    expect(node.provenance).toHaveProperty('uncertaintyScore')
    expect(node.provenance).toHaveProperty('reviewStatus')
  })

  it('filters by domain when requested', async () => {
    mocks.biomarkerFindMany.mockResolvedValueOnce([makeBiomarker('b1', 'CRP', 3.2)])
    mocks.protocolFindMany.mockResolvedValueOnce([makeProtocol('p1', 'Rapamycin')])

    const graph = await buildLongitudinalGraph(uid, { domains: ['biomarker'] })
    expect(graph.nodeCount).toBe(1)
    expect(graph.nodes[0].domain).toBe('biomarker')
    // Protocol findMany should NOT have been called
    expect(mocks.protocolFindMany).not.toHaveBeenCalled()
  })

  it('sorted by occurredAt descending', async () => {
    const early = new Date('2024-01-01')
    const late = new Date('2024-06-01')
    mocks.biomarkerFindMany.mockResolvedValueOnce([
      { ...makeBiomarker('b1', 'CRP', 3.2), measuredAt: early, createdAt: early },
      { ...makeBiomarker('b2', 'HbA1c', 5.5), measuredAt: late, createdAt: late },
    ])

    const graph = await buildLongitudinalGraph(uid, { domains: ['biomarker'] })
    expect(graph.nodes[0].entityId).toBe('b2') // later date first
  })

  it('builds outcome nodes with delta and confidence', async () => {
    mocks.outcomeFindMany.mockResolvedValueOnce([makeOutcome('o1')])

    const graph = await buildLongitudinalGraph(uid, { domains: ['outcome'] })
    expect(graph.nodeCount).toBe(1)
    expect(graph.nodes[0].payload).toHaveProperty('delta', -2)
    expect(graph.nodes[0].payload).toHaveProperty('confidence', 0.8)
  })

  it('builds discovery nodes from AeonForge candidates', async () => {
    mocks.candidateFindMany.mockResolvedValueOnce([makeCandidate('c1', 'approved')])

    const graph = await buildLongitudinalGraph(uid, { domains: ['discovery'] })
    expect(graph.nodeCount).toBe(1)
    expect(graph.nodes[0].provenance.reviewStatus).toBe('verified') // approved → verified
  })
})

// ---------------------------------------------------------------------------
// P3.1 — Provenance Tracking
// ---------------------------------------------------------------------------

describe('P3.1 — Provenance Tracking', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty array when user has no provenance data', async () => {
    const snapshots = await getProvenanceSnapshots(uid)
    expect(snapshots).toEqual([])
  })

  it('marks high-impact items based on uncertainty threshold', async () => {
    mocks.evidenceFindMany.mockResolvedValueOnce([
      makeEvidence('e1', 'Low uncertainty', { uncertaintyScore: 0.1 }),
      makeEvidence('e2', 'High uncertainty', { uncertaintyScore: 0.5 }),
    ])

    const snapshots = await getProvenanceSnapshots(uid, { domains: ['evidence'] })
    expect(snapshots.length).toBe(2)
    expect(snapshots.find((s) => s.entityId === 'e1')?.highImpact).toBe(false)
    expect(snapshots.find((s) => s.entityId === 'e2')?.highImpact).toBe(true)
  })

  it('filters to high-impact only when requested', async () => {
    mocks.evidenceFindMany.mockResolvedValueOnce([
      makeEvidence('e1', 'Low', { uncertaintyScore: 0.1 }),
      makeEvidence('e2', 'High', { uncertaintyScore: 0.6 }),
    ])

    const snapshots = await getProvenanceSnapshots(uid, { domains: ['evidence'], highImpactOnly: true })
    expect(snapshots.length).toBe(1)
    expect(snapshots[0].entityId).toBe('e2')
  })
})

// ---------------------------------------------------------------------------
// P3.1 — Cross-Domain Reviewer Workflow
// ---------------------------------------------------------------------------

describe('P3.1 — Cross-Domain Reviewer Workflow', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('aggregates review queue across domains', async () => {
    mocks.evidenceFindMany.mockResolvedValueOnce([makeEvidence('e1', 'Evidence 1')])
    mocks.clinicianTaskFindMany.mockResolvedValueOnce([makeClinicianTask('t1')])
    mocks.discoveryFindMany.mockResolvedValueOnce([makeDiscovery('d1')])

    const queue = await getReviewQueue()
    expect(queue.length).toBe(3)
    expect(queue.map((q) => q.domain)).toContain('evidence')
    expect(queue.map((q) => q.domain)).toContain('clinician-task')
    expect(queue.map((q) => q.domain)).toContain('marketplace-discovery')
  })

  it('sorts queue by priority descending', async () => {
    mocks.evidenceFindMany.mockResolvedValueOnce([makeEvidence('e1', 'High score', { evidenceScore: 0.95 })])
    mocks.clinicianTaskFindMany.mockResolvedValueOnce([])
    mocks.discoveryFindMany.mockResolvedValueOnce([makeDiscovery('d1')])

    const queue = await getReviewQueue()
    expect(queue[0].priority).toBeGreaterThanOrEqual(queue[queue.length - 1].priority)
  })

  it('filters by domain', async () => {
    mocks.evidenceFindMany.mockResolvedValueOnce([makeEvidence('e1', 'Ev 1')])

    const queue = await getReviewQueue({ domains: ['evidence'] })
    expect(queue.length).toBe(1)
    expect(queue[0].domain).toBe('evidence')
  })

  it('submits evidence approval correctly', async () => {
    mocks.evidenceUpdate.mockResolvedValueOnce({})

    const result = await submitReviewDecision({
      domain: 'evidence',
      entityId: 'e1',
      action: 'approve',
      reviewerUserId: 'reviewer-1',
    })
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('VERIFIED')
    expect(mocks.evidenceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({ reviewStatus: 'VERIFIED', reviewedByUserId: 'reviewer-1' }),
      }),
    )
  })

  it('submits clinician task escalation correctly', async () => {
    mocks.clinicianTaskUpdate.mockResolvedValueOnce({})

    const result = await submitReviewDecision({
      domain: 'clinician-task',
      entityId: 't1',
      action: 'escalate',
      reviewerUserId: 'reviewer-1',
    })
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('IN_PROGRESS')
  })

  it('submits marketplace discovery rejection correctly', async () => {
    mocks.discoveryUpdate.mockResolvedValueOnce({})

    const result = await submitReviewDecision({
      domain: 'marketplace-discovery',
      entityId: 'd1',
      action: 'reject',
      reviewerUserId: 'reviewer-1',
    })
    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('ARCHIVED')
  })
})

// ---------------------------------------------------------------------------
// P3.2 — Trust Score Engine
// ---------------------------------------------------------------------------

describe('P3.2 — Trust Score Engine', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null for non-existent scientist', async () => {
    const score = await computeScientistTrust('unknown')
    expect(score).toBeNull()
  })

  it('computes scientist trust with correct dimensions', async () => {
    mocks.scientistFindUnique.mockResolvedValueOnce({
      id: 'sci-1', userId: uid, displayName: 'Dr. Test', reputationScore: 0.6,
      discoveries: [{ id: 'd1', status: 'approved', createdAt: now }],
      fundingRequests: [{ id: 'fr1', status: 'FUNDED' }],
    })
    mocks.evidenceFindMany.mockResolvedValueOnce([
      { reviewStatus: 'VERIFIED', evidenceScore: 0.9 },
      { reviewStatus: 'PENDING', evidenceScore: 0.7 },
    ])
    mocks.scientistUpdate.mockResolvedValueOnce({})

    const score = await computeScientistTrust(uid)
    expect(score).not.toBeNull()
    expect(score!.actorRole).toBe('scientist')
    expect(score!.overallScore).toBeGreaterThan(0)
    expect(score!.overallScore).toBeLessThanOrEqual(1)
    expect(score!.components.length).toBe(4)
    expect(score!.components.map((c) => c.dimension)).toEqual(
      expect.arrayContaining(['evidenceQuality', 'outcomeValidation', 'reputationHistory', 'communityEngagement']),
    )
  })

  it('returns null for non-existent sponsor', async () => {
    const score = await computeSponsorTrust('unknown')
    expect(score).toBeNull()
  })

  it('computes sponsor trust with funding reliability', async () => {
    mocks.sponsorFindUnique.mockResolvedValueOnce({
      id: 'spon-1', userId: uid, organizationName: 'Test Org', capitalAvailableCents: 1000000,
      transactions: [
        { id: 'tx1', status: 'SETTLED', amountCents: 50000 },
        { id: 'tx2', status: 'PENDING', amountCents: 20000 },
      ],
      dealRooms: [{ id: 'dr1', status: 'FUNDED' }, { id: 'dr2', status: 'OPEN' }],
    })

    const score = await computeSponsorTrust(uid)
    expect(score).not.toBeNull()
    expect(score!.actorRole).toBe('sponsor')
    expect(score!.components.find((c) => c.dimension === 'fundingReliability')!.score).toBe(0.5) // 1/2
  })

  it('computes reviewer trust for clinician role', async () => {
    mocks.userFindUnique.mockResolvedValueOnce({ id: uid, name: 'Dr. Reviewer', email: 'dr@test.com', role: 'CLINICIAN' })
    mocks.evidenceFindMany.mockResolvedValueOnce([
      { reviewStatus: 'VERIFIED', reviewConfidence: 0.9 },
      { reviewStatus: 'VERIFIED', reviewConfidence: 0.8 },
    ])

    const score = await computeReviewerTrust(uid)
    expect(score).not.toBeNull()
    expect(score!.actorRole).toBe('reviewer')
    expect(score!.components.find((c) => c.dimension === 'roleWeight')!.score).toBe(0.9) // CLINICIAN
  })
})

// ---------------------------------------------------------------------------
// P3.3 — Outcome-Indexed Feedback Scoring
// ---------------------------------------------------------------------------

describe('P3.3 — Outcome-Indexed Feedback Scoring', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns near-zero scores for user with no data', async () => {
    const score = await computeOutcomeFeedbackScore(uid)
    // adverseEventFreedom = 1.0 when no interactions exist, so weightedScore > 0
    // but loopStrength is near-zero because stageCoverage is low
    expect(score.loopStrength).toBeCloseTo(0, 1)
    expect(score.weightedScore).toBeGreaterThanOrEqual(0)
    expect(score.interactionCount).toBeGreaterThanOrEqual(0)
  })

  it('computes positive delta rate from outcomes', async () => {
    mocks.outcomeFindMany.mockResolvedValueOnce([
      { delta: 2, confidenceScore: 0.9 },
      { delta: -1, confidenceScore: 0.7 },
    ])
    mocks.protocolFindMany.mockResolvedValueOnce([{ status: 'completed' }])
    mocks.evidenceFindMany.mockResolvedValueOnce([{ reviewStatus: 'VERIFIED' }])
    mocks.candidateFindMany.mockResolvedValueOnce([{ status: 'approved' }])
    mocks.biomarkerCount.mockResolvedValueOnce(5)

    const score = await computeOutcomeFeedbackScore(uid)
    expect(score.positiveDeltaRate).toBe(0.45) // 0.9 / 2
    expect(score.protocolCompletionRate).toBe(1)
    expect(score.evidenceVerificationRate).toBe(1)
    expect(score.loopStrength).toBeGreaterThan(0)
  })

  it('computes all five outcome components', async () => {
    const score = await computeOutcomeFeedbackScore(uid)
    expect(score.components.length).toBe(5)
    expect(score.components.map((c) => c.dimension)).toEqual(
      expect.arrayContaining(['positiveDelta', 'protocolCompletion', 'evidenceVerification', 'discoveryApproval', 'adverseEventFreedom']),
    )
  })

  it('loop strength increases with stage coverage', async () => {
    // No data in any stage
    const score1 = await computeOutcomeFeedbackScore(uid)

    // Add data to multiple stages
    mocks.outcomeFindMany.mockResolvedValueOnce([{ delta: 2, confidenceScore: 0.9 }])
    mocks.protocolFindMany.mockResolvedValueOnce([{ status: 'completed' }])
    mocks.evidenceFindMany.mockResolvedValueOnce([{ reviewStatus: 'VERIFIED' }])
    mocks.candidateFindMany.mockResolvedValueOnce([{ status: 'approved' }])
    mocks.biomarkerCount.mockResolvedValueOnce(10)

    const score2 = await computeOutcomeFeedbackScore(uid)
    expect(score2.loopStrength).toBeGreaterThan(score1.loopStrength)
  })
})

// ---------------------------------------------------------------------------
// Type-level checks
// ---------------------------------------------------------------------------

describe('P3 — Type contracts', () => {
  it('GraphNode has required shape', () => {
    const node: GraphNode = {
      id: 'test:1',
      domain: 'biomarker',
      title: 'Test',
      summary: 'Summary',
      occurredAt: now.toISOString(),
      createdAt: now.toISOString(),
      entityId: '1',
      provenance: { source: 'test', sourceType: 'manual', uncertaintyScore: 0, reviewStatus: 'unreviewed' },
      linkedEntityIds: {},
      payload: {},
    }
    expect(node).toBeDefined()
  })
})
