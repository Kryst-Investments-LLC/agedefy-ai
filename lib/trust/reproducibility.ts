/**
 * Reproducibility & Replication Funding Primitives
 *
 * Adds the ability for sponsors to fund replication studies that validate
 * or challenge existing findings. Replication requests track the original
 * evidence/discovery, required validation criteria, and funding milestones.
 *
 * @module lib/trust/reproducibility
 */

import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type ReplicationStatus =
  | 'proposed'
  | 'funded'
  | 'in-progress'
  | 'completed-confirmed'
  | 'completed-refuted'
  | 'withdrawn'

export interface ReplicationRequest {
  id: string
  originalEntityId: string
  originalEntityType: 'evidence' | 'discovery' | 'hypothesis'
  title: string
  rationale: string
  validationCriteria: string[]
  fundingGoalCents: number
  fundedCents: number
  status: ReplicationStatus
  proposedByUserId: string
  sponsorUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateReplicationInput {
  originalEntityId: string
  originalEntityType: 'evidence' | 'discovery' | 'hypothesis'
  title: string
  rationale: string
  validationCriteria: string[]
  fundingGoalCents: number
  proposedByUserId: string
}

export interface FundReplicationInput {
  replicationId: string
  sponsorUserId: string
  amountCents: number
}

/* ------------------------------------------------------------------ */
/*  JSON-backed replication store                                     */
/*                                                                    */
/*  Uses MarketplaceFundingRequest with a replication-specific         */
/*  category stored in the milestonePlan JSON field. The existing      */
/*  model fields are used semantically:                               */
/*    useOfFunds      → title + rationale text                        */
/*    requestedAmountCents → funding goal                             */
/*    milestonePlan   → replication metadata (criteria, outcome, etc) */
/*    evidenceUploads → validation criteria array                     */
/*    discoveryId     → required link (original entity if discovery)  */
/* ------------------------------------------------------------------ */

const REPLICATION_CATEGORY = 'REPLICATION_STUDY'

/**
 * Propose a new replication study.
 */
export async function proposeReplication(
  input: CreateReplicationInput,
): Promise<ReplicationRequest> {
  // Verify original entity exists
  const exists = await verifyEntity(input.originalEntityId, input.originalEntityType)
  if (!exists) throw new Error(`Original entity not found: ${input.originalEntityType}:${input.originalEntityId}`)

  // Get scientist profile (the proposer must be a registered scientist)
  const scientist = await db.marketplaceScientist.findUnique({
    where: { userId: input.proposedByUserId },
  })
  if (!scientist) throw new Error('Proposer must be a registered marketplace scientist')

  // For non-discovery entity types, we still need a discoveryId (required field).
  // Use the original entity ID as a placeholder — the milestonePlan JSON tracks the real entity type.
  const discoveryId = input.originalEntityId

  const fr = await db.marketplaceFundingRequest.create({
    data: {
      scientistId: scientist.id,
      discoveryId,
      requestedAmountCents: input.fundingGoalCents,
      useOfFunds: `[REPLICATION] ${input.title}\n\n${input.rationale}`,
      timelineMonths: 12,
      status: 'OPEN',
      milestonePlan: JSON.parse(JSON.stringify({
        category: REPLICATION_CATEGORY,
        originalEntityId: input.originalEntityId,
        originalEntityType: input.originalEntityType,
        replicationOutcome: null,
        milestones: [
          { label: 'Proposal accepted', target: 'proposed' },
          { label: 'Funding secured', target: 'funded' },
          { label: 'Replication completed', target: 'completed' },
        ],
      })),
      evidenceUploads: JSON.parse(JSON.stringify(input.validationCriteria)),
    },
  })

  return toReplicationRequest(fr)
}

/**
 * Fund a replication study (advances status to COMMITTED).
 */
export async function fundReplication(input: FundReplicationInput): Promise<ReplicationRequest> {
  const fr = await db.marketplaceFundingRequest.findUnique({
    where: { id: input.replicationId },
  })
  if (!fr) throw new Error('Replication request not found')

  const metadata = parseMilestonePlan(fr.milestonePlan)
  if (metadata?.category !== REPLICATION_CATEGORY) {
    throw new Error('Entity is not a replication study')
  }

  const updated = await db.marketplaceFundingRequest.update({
    where: { id: input.replicationId },
    data: {
      status: 'COMMITTED',
    },
  })

  return toReplicationRequest(updated)
}

/**
 * Mark a replication study as completed (confirmed or refuted).
 */
export async function completeReplication(
  replicationId: string,
  outcome: 'confirmed' | 'refuted',
): Promise<ReplicationRequest> {
  const fr = await db.marketplaceFundingRequest.findUnique({
    where: { id: replicationId },
  })
  if (!fr) throw new Error('Replication request not found')

  const existingPlan = parseMilestonePlan(fr.milestonePlan) ?? {}

  const updated = await db.marketplaceFundingRequest.update({
    where: { id: replicationId },
    data: {
      status: 'CLOSED',
      milestonePlan: JSON.parse(JSON.stringify({
        ...existingPlan,
        replicationOutcome: outcome,
      })),
    },
  })

  return toReplicationRequest(updated)
}

/**
 * List all replication studies, optionally filtered.
 */
export async function listReplications(
  options: { proposedByUserId?: string; status?: string; limit?: number } = {},
): Promise<ReplicationRequest[]> {
  const where: Record<string, unknown> = {}

  if (options.proposedByUserId) {
    const scientist = await db.marketplaceScientist.findUnique({
      where: { userId: options.proposedByUserId },
      select: { id: true },
    })
    if (scientist) where.scientistId = scientist.id
  }
  if (options.status) {
    where.status = options.status === 'proposed' ? 'OPEN' : options.status.toUpperCase()
  }

  const records = await db.marketplaceFundingRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options.limit ?? 50,
  })

  return records
    .filter((r) => parseMilestonePlan(r.milestonePlan)?.category === REPLICATION_CATEGORY)
    .map(toReplicationRequest)
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMilestonePlan(plan: any): Record<string, unknown> | null {
  if (!plan) return null
  if (typeof plan === 'string') {
    try { return JSON.parse(plan) } catch { return null }
  }
  return plan as Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toReplicationRequest(fr: any): ReplicationRequest {
  const plan = parseMilestonePlan(fr.milestonePlan) ?? {}
  const statusMap: Record<string, ReplicationStatus> = {
    DRAFT: 'proposed',
    OPEN: 'proposed',
    DUE_DILIGENCE: 'in-progress',
    COMMITTED: 'funded',
    CLOSED: plan.replicationOutcome === 'refuted' ? 'completed-refuted' : 'completed-confirmed',
  }

  // Extract title from useOfFunds (format: "[REPLICATION] Title\n\nRationale")
  const useOfFunds: string = fr.useOfFunds ?? ''
  const titleMatch = useOfFunds.match(/^\[REPLICATION\]\s*(.+?)(?:\n|$)/)
  const title = titleMatch?.[1] ?? useOfFunds.slice(0, 100)
  const rationale = useOfFunds.replace(/^\[REPLICATION\]\s*.+?\n\n?/, '')

  return {
    id: fr.id,
    originalEntityId: (plan.originalEntityId as string) ?? '',
    originalEntityType: (plan.originalEntityType as 'evidence' | 'discovery' | 'hypothesis') ?? 'evidence',
    title,
    rationale,
    validationCriteria: Array.isArray(fr.evidenceUploads) ? (fr.evidenceUploads as string[]) : [],
    fundingGoalCents: fr.requestedAmountCents,
    fundedCents: fr.status === 'COMMITTED' || fr.status === 'CLOSED' ? fr.requestedAmountCents : 0,
    status: statusMap[fr.status] ?? 'proposed',
    proposedByUserId: fr.scientistId,
    sponsorUserId: null,
    createdAt: fr.createdAt.toISOString(),
    updatedAt: fr.updatedAt.toISOString(),
  }
}

async function verifyEntity(entityId: string, entityType: string): Promise<boolean> {
  switch (entityType) {
    case 'evidence':
      return !!(await db.evidenceRecord.findUnique({ where: { id: entityId }, select: { id: true } }))
    case 'discovery':
      return !!(await db.marketplaceDiscovery.findUnique({ where: { id: entityId }, select: { id: true } }))
    case 'hypothesis':
      return !!(await db.hypothesis.findUnique({ where: { id: entityId }, select: { id: true } }))
    default:
      return false
  }
}
