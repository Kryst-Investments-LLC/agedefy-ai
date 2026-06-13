import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export type GovernanceDecision = 'AUTO_APPROVED' | 'AWAITING_REVIEW' | 'ESCALATED'

export type CompoundGovernanceResult = {
  compoundName: string
  riskCategory: 'GREEN' | 'YELLOW' | 'RED'
  decision: GovernanceDecision
  reason: string
  policySnapshot: PolicySnapshot
}

export type GovernanceEvaluation = {
  results: CompoundGovernanceResult[]
  autoApprovedCount: number
  reviewRequiredCount: number
  escalatedCount: number
  overallDecision: GovernanceDecision
}

type PolicySnapshot = {
  category: string
  autoApprove: boolean
  minAdherenceRate: number
  requireLabReview: boolean
  maxAutoApprovePerSession: number
}

// ─── Default Policies ──────────────────────────────────────
// Used when no GovernancePolicy row exists for a category.

const DEFAULT_POLICIES: Record<string, PolicySnapshot> = {
  GREEN: {
    category: 'GREEN',
    autoApprove: true,
    minAdherenceRate: 0.8,
    requireLabReview: false,
    maxAutoApprovePerSession: 5,
  },
  YELLOW: {
    category: 'YELLOW',
    autoApprove: false,
    minAdherenceRate: 0.8,
    requireLabReview: false,
    maxAutoApprovePerSession: 0,
  },
  RED: {
    category: 'RED',
    autoApprove: false,
    minAdherenceRate: 1.0,
    requireLabReview: true,
    maxAutoApprovePerSession: 0,
  },
}

// ─── Risk Classification ───────────────────────────────────

/**
 * Infers the risk category for a compound by looking up the Compound table.
 * Falls back to category-based heuristics if not found.
 */
async function resolveRiskCategory(compoundName: string): Promise<'GREEN' | 'YELLOW' | 'RED'> {
  const compound = await db.compound.findFirst({
    where: {
      OR: [
        { name: { equals: compoundName } },
        { aliases: { contains: compoundName } },
      ],
    },
    select: { riskCategory: true, category: true },
  })

  if (compound) {
    return compound.riskCategory
  }

  // Heuristic fallback based on common compound categories
  const lower = compoundName.toLowerCase()

  const redPatterns = [
    'peptide', 'bpc-157', 'bpc157', 'tb-500', 'tb500', 'ipamorelin',
    'sermorelin', 'tesamorelin', 'hrt', 'testosterone', 'estrogen',
    'progesterone', 'dhea', 'pregnenolone', 'metformin', 'rapamycin',
    'sirolimus', 'dasatinib', 'fisetin',
  ]

  const yellowPatterns = [
    'senolytic', 'nad+', 'nad', 'nmn', 'nr', 'nicotinamide riboside',
    'resveratrol', 'pterostilbene', 'berberine', 'quercetin',
    'spermidine', 'sulforaphane',
  ]

  if (redPatterns.some((p) => lower.includes(p))) return 'RED'
  if (yellowPatterns.some((p) => lower.includes(p))) return 'YELLOW'
  return 'GREEN'
}

/**
 * Fetches the governance policy for a risk category. Falls back to defaults.
 */
async function getPolicy(category: 'GREEN' | 'YELLOW' | 'RED'): Promise<PolicySnapshot> {
  const policy = await db.governancePolicy.findUnique({
    where: { category },
  })

  if (policy) {
    return {
      category: policy.category,
      autoApprove: policy.autoApprove,
      minAdherenceRate: policy.minAdherenceRate,
      requireLabReview: policy.requireLabReview,
      maxAutoApprovePerSession: policy.maxAutoApprovePerSession,
    }
  }

  return DEFAULT_POLICIES[category] ?? DEFAULT_POLICIES.GREEN
}

// ─── Core Evaluation ───────────────────────────────────────

/**
 * Evaluates all recommended compounds against the governance policies.
 * Returns per-compound decisions and an overall session-level decision.
 */
export async function evaluateGovernance(
  compoundNames: string[],
  adherenceRate: number | null,
  sessionId: string,
  userId: string,
  tenantId: string,
  hasLabReport: boolean,
): Promise<GovernanceEvaluation> {
  if (compoundNames.length === 0) {
    return {
      results: [],
      autoApprovedCount: 0,
      reviewRequiredCount: 0,
      escalatedCount: 0,
      overallDecision: 'AUTO_APPROVED',
    }
  }

  const results: CompoundGovernanceResult[] = []
  let autoApprovedThisSession = 0

  for (const name of compoundNames) {
    const riskCategory = await resolveRiskCategory(name)
    const policy = await getPolicy(riskCategory)

    let decision: GovernanceDecision
    let reason: string

    if (riskCategory === 'RED') {
      // RED — always escalate, no auto-approve ever
      decision = 'ESCALATED'
      reason = `${name} is classified as RED (high-risk). Requires clinician signature and${policy.requireLabReview ? ' lab-value verification and' : ''} explicit approval before user notification.`
    } else if (
      policy.autoApprove &&
      adherenceRate !== null &&
      adherenceRate >= policy.minAdherenceRate &&
      autoApprovedThisSession < policy.maxAutoApprovePerSession &&
      (!policy.requireLabReview || hasLabReport)
    ) {
      // GREEN/YELLOW auto-approve conditions met
      decision = 'AUTO_APPROVED'
      reason = `${name} (${riskCategory}) auto-approved — adherence ${Math.round(adherenceRate * 100)}% meets ${Math.round(policy.minAdherenceRate * 100)}% threshold, zero contraindications.`
      autoApprovedThisSession++
    } else {
      // Passive review required
      decision = 'AWAITING_REVIEW'
      const reasons: string[] = []
      if (!policy.autoApprove) reasons.push('auto-approve disabled for this tier')
      if (adherenceRate !== null && adherenceRate < policy.minAdherenceRate) {
        reasons.push(`adherence ${Math.round(adherenceRate * 100)}% < ${Math.round(policy.minAdherenceRate * 100)}% threshold`)
      }
      if (adherenceRate === null) reasons.push('adherence data unavailable')
      if (autoApprovedThisSession >= policy.maxAutoApprovePerSession) {
        reasons.push('session auto-approve limit reached')
      }
      if (policy.requireLabReview && !hasLabReport) {
        reasons.push('lab report required but not provided')
      }
      reason = `${name} (${riskCategory}) requires clinician review: ${reasons.join(', ')}.`
    }

    results.push({
      compoundName: name,
      riskCategory,
      decision,
      reason,
      policySnapshot: policy,
    })

    // Persist governance audit log
    try {
      await db.governanceAuditLog.create({
        data: {
          sessionId,
          userId,
          tenantId,
          compoundName: name,
          riskCategory,
          decision,
          policySnapshot: JSON.stringify(policy),
          adherenceRate,
          reason,
        },
      })
    } catch (err) {
      logger.error('Failed to persist governance audit log', {
        compoundName: name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const autoApprovedCount = results.filter((r) => r.decision === 'AUTO_APPROVED').length
  const reviewRequiredCount = results.filter((r) => r.decision === 'AWAITING_REVIEW').length
  const escalatedCount = results.filter((r) => r.decision === 'ESCALATED').length

  // Overall decision: if ANY compound is escalated or awaiting review, session needs review
  let overallDecision: GovernanceDecision = 'AUTO_APPROVED'
  if (escalatedCount > 0) overallDecision = 'ESCALATED'
  else if (reviewRequiredCount > 0) overallDecision = 'AWAITING_REVIEW'

  return {
    results,
    autoApprovedCount,
    reviewRequiredCount,
    escalatedCount,
    overallDecision,
  }
}
