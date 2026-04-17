/**
 * Mission Control Workspace
 *
 * Aggregates the user's entire platform state into a single persistent
 * workspace view. Different roles (user, clinician, operator) see
 * different slices of the data.
 *
 * @module lib/loop/mission-control
 */

import { db } from '@/lib/db'
import { buildLoopSnapshot, type LoopSnapshot } from '@/lib/loop/feedback-loop'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type MissionControlRole = 'user' | 'clinician' | 'operator'

export interface MissionControlWorkspace {
  role: MissionControlRole
  userId: string
  summary: WorkspaceSummary
  loop: LoopSnapshot
  alerts: WorkspaceAlert[]
  generatedAt: string
}

export interface WorkspaceSummary {
  biomarkerCount: number
  activeProtocols: number
  pendingReviews: number
  outstandingOutcomes: number
  discoveryCount: number
  adverseEventCount: number
  /** Role-specific metric counts */
  roleMetrics: Record<string, number>
}

export interface WorkspaceAlert {
  severity: 'info' | 'warning' | 'critical'
  domain: string
  message: string
  entityId?: string
}

/* ------------------------------------------------------------------ */
/*  Workspace builders                                                */
/* ------------------------------------------------------------------ */

async function buildUserWorkspace(userId: string): Promise<{ summary: WorkspaceSummary; alerts: WorkspaceAlert[] }> {
  const [
    biomarkerCount,
    activeProtocols,
    outcomes,
    discoveries,
    adverseEvents,
    pendingConsults,
  ] = await Promise.all([
    db.biomarker.count({ where: { userId } }),
    db.protocol.count({ where: { userId, status: 'active' } }),
    db.interventionOutcome.findMany({ where: { userId }, select: { confidenceScore: true } }),
    db.aeonForgeCandidate.count({ where: { userId } }),
    db.adverseEventReport.findMany({ where: { userId }, select: { id: true, severity: true, escalationRequired: true } }),
    db.consultationRequest.count({ where: { userId, status: { in: ['REQUESTED', 'SCHEDULED'] } } }),
  ])

  const lowConfidenceOutcomes = outcomes.filter((o) => o.confidenceScore < 0.5).length
  const criticalAE = adverseEvents.filter((ae) => ae.severity === 'SEVERE' || ae.escalationRequired)

  const alerts: WorkspaceAlert[] = []
  if (lowConfidenceOutcomes > 0) {
    alerts.push({ severity: 'warning', domain: 'outcome', message: `${lowConfidenceOutcomes} outcome(s) with low confidence — consider adding more data points` })
  }
  for (const ae of criticalAE) {
    alerts.push({ severity: 'critical', domain: 'adverse-event', message: 'Critical adverse event requires attention', entityId: ae.id })
  }
  if (pendingConsults > 0) {
    alerts.push({ severity: 'info', domain: 'consultation', message: `${pendingConsults} consultation(s) pending or scheduled` })
  }

  return {
    summary: {
      biomarkerCount,
      activeProtocols,
      pendingReviews: 0,
      outstandingOutcomes: outcomes.length,
      discoveryCount: discoveries,
      adverseEventCount: adverseEvents.length,
      roleMetrics: {
        pendingConsultations: pendingConsults,
        lowConfidenceOutcomes,
      },
    },
    alerts,
  }
}

async function buildClinicianWorkspace(userId: string): Promise<{ summary: WorkspaceSummary; alerts: WorkspaceAlert[] }> {
  const [
    openTasks,
    escalatedTasks,
    pendingEvidence,
    adverseEvents,
  ] = await Promise.all([
    db.clinicianTask.count({ where: { userId, status: 'PENDING' } }),
    db.clinicianTask.count({ where: { userId, status: 'IN_PROGRESS' } }),
    db.evidenceRecord.count({ where: { reviewStatus: { in: ['AUTO_QUEUED', 'IN_REVIEW'] } } }),
    db.adverseEventReport.count({ where: { escalationRequired: true } }),
  ])

  const alerts: WorkspaceAlert[] = []
  if (escalatedTasks > 0) {
    alerts.push({ severity: 'critical', domain: 'clinician-task', message: `${escalatedTasks} in-progress task(s) await your review` })
  }
  if (adverseEvents > 0) {
    alerts.push({ severity: 'warning', domain: 'adverse-event', message: `${adverseEvents} adverse event(s) flagged for escalation` })
  }

  return {
    summary: {
      biomarkerCount: 0,
      activeProtocols: 0,
      pendingReviews: openTasks + pendingEvidence,
      outstandingOutcomes: 0,
      discoveryCount: 0,
      adverseEventCount: adverseEvents,
      roleMetrics: {
        openTasks,
        escalatedTasks,
        pendingEvidenceReviews: pendingEvidence,
      },
    },
    alerts,
  }
}

async function buildOperatorWorkspace(_userId: string): Promise<{ summary: WorkspaceSummary; alerts: WorkspaceAlert[] }> {
  const [
    totalUsers,
    pendingEvidence,
    pendingDiscoveries,
    activeDeals,
    adverseEvents,
  ] = await Promise.all([
    db.user.count(),
    db.evidenceRecord.count({ where: { reviewStatus: { in: ['AUTO_QUEUED', 'IN_REVIEW', 'ESCALATED'] } } }),
    db.marketplaceDiscovery.count({ where: { status: { in: ['DRAFT', 'REVIEW'] } } }),
    db.marketplaceDealRoom.count({ where: { status: { in: ['OPEN', 'NEGOTIATING'] } } }),
    db.adverseEventReport.count({ where: { escalationRequired: true } }),
  ])

  const alerts: WorkspaceAlert[] = []
  if (pendingEvidence > 20) {
    alerts.push({ severity: 'warning', domain: 'evidence', message: `${pendingEvidence} evidence items in review queue — consider assigning more reviewers` })
  }
  if (adverseEvents > 0) {
    alerts.push({ severity: 'critical', domain: 'adverse-event', message: `${adverseEvents} adverse event(s) flagged platform-wide` })
  }

  return {
    summary: {
      biomarkerCount: 0,
      activeProtocols: 0,
      pendingReviews: pendingEvidence + pendingDiscoveries,
      outstandingOutcomes: 0,
      discoveryCount: pendingDiscoveries,
      adverseEventCount: adverseEvents,
      roleMetrics: {
        totalUsers,
        pendingEvidenceReviews: pendingEvidence,
        pendingDiscoveryReviews: pendingDiscoveries,
        activeDealRooms: activeDeals,
      },
    },
    alerts,
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export async function buildMissionControl(
  userId: string,
  role: MissionControlRole,
): Promise<MissionControlWorkspace> {
  const workspaceBuilder =
    role === 'clinician' ? buildClinicianWorkspace
      : role === 'operator' ? buildOperatorWorkspace
        : buildUserWorkspace

  const [{ summary, alerts }, loop] = await Promise.all([
    workspaceBuilder(userId),
    buildLoopSnapshot(userId),
  ])

  return {
    role,
    userId,
    summary,
    loop,
    alerts: alerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 }
      return order[a.severity] - order[b.severity]
    }),
    generatedAt: new Date().toISOString(),
  }
}
