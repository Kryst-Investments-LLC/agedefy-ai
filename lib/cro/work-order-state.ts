/**
 * CRO Work Order — status state machine (pure)
 *
 * Defines the legal lifecycle transitions for a CroWorkOrder:
 *
 *   DRAFT → QUOTED → FUNDED → IN_PROGRESS → DELIVERED → RECONCILED
 *      └────────┴────────┴──────────┴───────────┴──→ CANCELLED
 *
 * RECONCILED and CANCELLED are terminal. Advancing to RECONCILED additionally
 * requires reconciled CandidateLabResult rows — that data check is enforced by
 * the route; this module only defines the legal transition graph.
 *
 * Pure — no DB, no I/O.
 *
 * @module lib/cro/work-order-state
 */

import { CroWorkOrderStatus } from "@prisma/client"

/** Allowed forward transitions from each status. */
export const CRO_TRANSITIONS: Record<CroWorkOrderStatus, CroWorkOrderStatus[]> = {
  DRAFT: [CroWorkOrderStatus.QUOTED, CroWorkOrderStatus.CANCELLED],
  QUOTED: [CroWorkOrderStatus.FUNDED, CroWorkOrderStatus.CANCELLED],
  FUNDED: [CroWorkOrderStatus.IN_PROGRESS, CroWorkOrderStatus.CANCELLED],
  IN_PROGRESS: [CroWorkOrderStatus.DELIVERED, CroWorkOrderStatus.CANCELLED],
  DELIVERED: [CroWorkOrderStatus.RECONCILED, CroWorkOrderStatus.CANCELLED],
  RECONCILED: [],
  CANCELLED: [],
}

export const CRO_TERMINAL_STATUSES: ReadonlySet<CroWorkOrderStatus> = new Set([
  CroWorkOrderStatus.RECONCILED,
  CroWorkOrderStatus.CANCELLED,
])

/** Whether a status is terminal (no further transitions). */
export function isTerminal(status: CroWorkOrderStatus): boolean {
  return CRO_TERMINAL_STATUSES.has(status)
}

/** Statuses reachable in one step from `from`. */
export function nextStatuses(from: CroWorkOrderStatus): CroWorkOrderStatus[] {
  return CRO_TRANSITIONS[from] ?? []
}

/** Whether `from → to` is a legal transition. */
export function canTransition(from: CroWorkOrderStatus, to: CroWorkOrderStatus): boolean {
  return nextStatuses(from).includes(to)
}

/**
 * Whether reaching `to` requires reconciled lab results to exist first.
 * The route must verify CandidateLabResult rows before applying this transition.
 */
export function requiresReconciledResults(to: CroWorkOrderStatus): boolean {
  return to === CroWorkOrderStatus.RECONCILED
}

export class CroTransitionError extends Error {
  constructor(
    public readonly from: CroWorkOrderStatus,
    public readonly to: CroWorkOrderStatus,
  ) {
    super(`Illegal CRO work-order transition: ${from} → ${to}`)
    this.name = "CroTransitionError"
  }
}

/** Assert a transition is legal; throws CroTransitionError otherwise. */
export function assertTransition(from: CroWorkOrderStatus, to: CroWorkOrderStatus): void {
  if (!canTransition(from, to)) throw new CroTransitionError(from, to)
}

/** Facts the route gathers to satisfy a transition's data requirements. */
export interface TransitionFacts {
  /** An escrow transaction is attached (or being attached this transition). */
  hasEscrow: boolean
  /** A LabSubmission has been dispatched (or is being attached). */
  hasSubmission: boolean
  /** Count of reconciled CandidateLabResult rows for the candidate. */
  reconciledResultCount: number
}

export interface RequirementCheck {
  ok: boolean
  reason?: string
}

/**
 * Data requirements that gate a transition beyond the legal graph (pure):
 *   - FUNDED needs escrow funding
 *   - IN_PROGRESS needs a dispatched LabSubmission
 *   - RECONCILED needs at least one reconciled lab result (no "validated"
 *     without real data — the integrity guard that closes the loop honestly)
 */
export function checkTransitionRequirements(
  to: CroWorkOrderStatus,
  facts: TransitionFacts,
): RequirementCheck {
  switch (to) {
    case CroWorkOrderStatus.FUNDED:
      return facts.hasEscrow
        ? { ok: true }
        : { ok: false, reason: "Funding requires an escrow transaction (escrowTransactionId)." }
    case CroWorkOrderStatus.IN_PROGRESS:
      return facts.hasSubmission
        ? { ok: true }
        : { ok: false, reason: "Starting work requires a dispatched LabSubmission (submissionId)." }
    case CroWorkOrderStatus.RECONCILED:
      return facts.reconciledResultCount > 0
        ? { ok: true }
        : { ok: false, reason: "Reconciliation requires at least one reconciled lab result." }
    default:
      return { ok: true }
  }
}
