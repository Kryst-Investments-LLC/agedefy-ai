import {
  AICreditSource,
  BillingRecordCategory,
  BillingRecordStatus,
  SubscriptionStatus,
  type Prisma,
  type Subscription,
} from "@prisma/client"

import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { resolveDefaultMonthlyAICreditAllowance } from "@/lib/pricing"

const activeSubscriptionStatuses: SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]
const committedBillingStatuses: BillingRecordStatus[] = [BillingRecordStatus.PENDING, BillingRecordStatus.PAID]

type BillingTransactionClient = Prisma.TransactionClient

export type AICreditUsageOperation =
  | "openai-query"
  | "anthropic-query"
  | "grok-query"
  | "aeonforge-smart-router"
  | "aeonforge-discovery"
  | "aeonforge-v1-discover"
  | "aeonforge-v1-simulate"
  | "aeonforge-v1-virtual-twin"

export type AICreditUsageEstimateInput = {
  operation: AICreditUsageOperation
  maxResults?: number
  includeSimulation?: boolean
  includeVirtualTwin?: boolean
  candidateCount?: number
  simulationTypeCount?: number
}

export type AICreditBalanceSnapshot = {
  activeSubscriptionPlan: string | null
  activeSubscriptionStatus: SubscriptionStatus | null
  includedCreditsTotal: number | null
  includedCreditsConsumed: number
  includedCreditsRemaining: number | null
  purchasedCreditsPurchased: number
  purchasedCreditsConsumed: number
  purchasedCreditsRemaining: number
  pendingReservedCredits: number
  enterprisePoolEnabled: boolean
  totalCreditsAvailable: number | null
  monthStart: string
  nextResetAt: string
}

export type AICreditReservationAllocation = {
  reservationId: string
  credits: number
  source: AICreditSource
}

export type AICreditReservation = {
  requestedCredits: number
  allocations: AICreditReservationAllocation[]
  snapshot: AICreditBalanceSnapshot
}

export type ReserveAICreditParams = {
  userId: string
  tenantId: string
  requestedCredits: number
  operation: AICreditUsageOperation
  route: string
  provider?: string
  model?: string
  description: string
  metadata?: Record<string, unknown>
  now?: Date
}

export type RunWithReservedAICreditsParams<T> = ReserveAICreditParams & {
  execute: () => Promise<T>
  shouldFinalize?: (result: T) => boolean
}

export class AICreditLimitError extends Error {
  status: number
  requestedCredits: number
  snapshot: AICreditBalanceSnapshot

  constructor(requestedCredits: number, snapshot: AICreditBalanceSnapshot) {
    super("Insufficient AI credits. Upgrade your subscription or purchase a top-up pack.")
    this.name = "AICreditLimitError"
    this.status = 402
    this.requestedCredits = requestedCredits
    this.snapshot = snapshot
  }
}

function getCurrentMonthWindow(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const nextResetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  return { monthStart, nextResetAt }
}

function getPositiveMagnitude(value: number | null | undefined) {
  if (!value || value >= 0) {
    return 0
  }

  return Math.abs(value)
}

function sanitizeMetadata(value?: Record<string, unknown>) {
  if (!value) {
    return undefined
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function resolveIncludedCreditsForSubscription(subscription: Subscription | null) {
  if (!subscription) {
    return {
      includedCreditsTotal: 0,
      enterprisePoolEnabled: false,
    }
  }

  if (typeof subscription.monthlyAICreditAllowance === "number") {
    return {
      includedCreditsTotal: Math.max(subscription.monthlyAICreditAllowance, 0),
      enterprisePoolEnabled: false,
    }
  }

  const includedCreditsTotal = resolveDefaultMonthlyAICreditAllowance(subscription.plan, subscription.seatQuantity)

  if (includedCreditsTotal === null) {
    return {
      includedCreditsTotal: 0,
      enterprisePoolEnabled: false,
    }
  }

  return {
    includedCreditsTotal,
    enterprisePoolEnabled: false,
  }
}

async function buildAICreditBalanceSnapshot(
  tx: BillingTransactionClient,
  userId: string,
  now = new Date(),
): Promise<AICreditBalanceSnapshot> {
  const { monthStart, nextResetAt } = getCurrentMonthWindow(now)

  const [subscription, includedUsageAggregate, purchasedCreditsAggregate, purchasedUsageAggregate, pendingUsageAggregate] = await Promise.all([
    tx.subscription.findFirst({
      where: {
        userId,
        status: { in: activeSubscriptionStatuses },
      },
      orderBy: { updatedAt: "desc" },
    }),
    tx.billingRecord.aggregate({
      where: {
        userId,
        category: BillingRecordCategory.AI_CREDIT_USAGE,
        aiCreditSource: {
          in: [AICreditSource.SUBSCRIPTION_ALLOWANCE, AICreditSource.ENTERPRISE_POOL],
        },
        status: { in: committedBillingStatuses },
        createdAt: {
          gte: monthStart,
          lt: nextResetAt,
        },
      },
      _sum: {
        aiCreditsDelta: true,
      },
    }),
    tx.billingRecord.aggregate({
      where: {
        userId,
        category: BillingRecordCategory.AI_CREDIT_PACK,
        status: BillingRecordStatus.PAID,
      },
      _sum: {
        aiCreditsDelta: true,
      },
    }),
    tx.billingRecord.aggregate({
      where: {
        userId,
        category: BillingRecordCategory.AI_CREDIT_USAGE,
        aiCreditSource: AICreditSource.PURCHASED_TOP_UP,
        status: { in: committedBillingStatuses },
      },
      _sum: {
        aiCreditsDelta: true,
      },
    }),
    tx.billingRecord.aggregate({
      where: {
        userId,
        category: BillingRecordCategory.AI_CREDIT_USAGE,
        status: BillingRecordStatus.PENDING,
      },
      _sum: {
        aiCreditsDelta: true,
      },
    }),
  ])

  const { includedCreditsTotal, enterprisePoolEnabled } = resolveIncludedCreditsForSubscription(subscription)
  const includedCreditsConsumed = getPositiveMagnitude(includedUsageAggregate._sum?.aiCreditsDelta)
  const includedCreditsRemaining = includedCreditsTotal === null
    ? null
    : Math.max(includedCreditsTotal - includedCreditsConsumed, 0)
  const purchasedCreditsPurchased = purchasedCreditsAggregate._sum.aiCreditsDelta ?? 0
  const purchasedCreditsConsumed = getPositiveMagnitude(purchasedUsageAggregate._sum?.aiCreditsDelta)
  const purchasedCreditsRemaining = Math.max(purchasedCreditsPurchased - purchasedCreditsConsumed, 0)
  const pendingReservedCredits = getPositiveMagnitude(pendingUsageAggregate._sum.aiCreditsDelta)

  return {
    activeSubscriptionPlan: subscription?.plan ?? null,
    activeSubscriptionStatus: subscription?.status ?? null,
    includedCreditsTotal,
    includedCreditsConsumed,
    includedCreditsRemaining,
    purchasedCreditsPurchased,
    purchasedCreditsConsumed,
    purchasedCreditsRemaining,
    pendingReservedCredits,
    enterprisePoolEnabled,
    totalCreditsAvailable: (includedCreditsRemaining ?? 0) + purchasedCreditsRemaining,
    monthStart: monthStart.toISOString(),
    nextResetAt: nextResetAt.toISOString(),
  }
}

function buildReservationAllocations(snapshot: AICreditBalanceSnapshot, requestedCredits: number) {
  const allocations: Array<{ credits: number; source: AICreditSource }> = []
  let remainingCredits = requestedCredits

  const includedCreditsRemaining = snapshot.includedCreditsRemaining ?? 0
  if (includedCreditsRemaining > 0) {
    const includedCreditsToReserve = Math.min(includedCreditsRemaining, remainingCredits)

    if (includedCreditsToReserve > 0) {
      allocations.push({
        credits: includedCreditsToReserve,
        source: AICreditSource.SUBSCRIPTION_ALLOWANCE,
      })
      remainingCredits -= includedCreditsToReserve
    }
  }

  if (remainingCredits > 0 && snapshot.purchasedCreditsRemaining > 0) {
    const purchasedCreditsToReserve = Math.min(snapshot.purchasedCreditsRemaining, remainingCredits)

    if (purchasedCreditsToReserve > 0) {
      allocations.push({
        credits: purchasedCreditsToReserve,
        source: AICreditSource.PURCHASED_TOP_UP,
      })
      remainingCredits -= purchasedCreditsToReserve
    }
  }

  if (remainingCredits > 0) {
    throw new AICreditLimitError(requestedCredits, snapshot)
  }

  return allocations
}

function describeAICreditSource(source: AICreditSource) {
  switch (source) {
    case AICreditSource.SUBSCRIPTION_ALLOWANCE:
      return "subscription allowance"
    case AICreditSource.PURCHASED_TOP_UP:
      return "purchased top-up"
    case AICreditSource.ENTERPRISE_POOL:
      return "enterprise pool"
  }
}

export function formatAICreditSource(source: AICreditSource | null | undefined) {
  if (!source) {
    return null
  }

  return describeAICreditSource(source)
}

export function serializeAICreditLimitError(error: AICreditLimitError) {
  return {
    error: error.message,
    requestedCredits: error.requestedCredits,
    includedCreditsRemaining: error.snapshot.includedCreditsRemaining,
    purchasedCreditsRemaining: error.snapshot.purchasedCreditsRemaining,
    enterprisePoolEnabled: error.snapshot.enterprisePoolEnabled,
    nextResetAt: error.snapshot.nextResetAt,
    activeSubscriptionPlan: error.snapshot.activeSubscriptionPlan,
  }
}

export function estimateAICreditCost(input: AICreditUsageEstimateInput) {
  switch (input.operation) {
    case "openai-query":
    case "anthropic-query":
    case "grok-query":
      return Math.max(1, input.maxResults ?? 1) * 5
    case "aeonforge-smart-router":
    case "aeonforge-discovery":
    case "aeonforge-v1-discover":
      return 25 + (input.includeSimulation ? 10 : 0) + (input.includeVirtualTwin ? 15 : 0)
    case "aeonforge-v1-simulate":
      return 20 + (Math.max(1, input.candidateCount ?? 1) - 1) * 5 + Math.max(1, input.simulationTypeCount ?? 1) * 4
    case "aeonforge-v1-virtual-twin":
      return 30 + (Math.max(1, input.candidateCount ?? 1) - 1) * 10
  }
}

export async function getAICreditBalanceSnapshot(userId: string, now = new Date()) {
  return db.$transaction((tx) => buildAICreditBalanceSnapshot(tx, userId, now))
}

export async function reserveAICredits(params: ReserveAICreditParams): Promise<AICreditReservation> {
  const requestedCredits = Math.max(1, Math.trunc(params.requestedCredits))

  return db.$transaction(async (tx) => {
    const snapshot = await buildAICreditBalanceSnapshot(tx, params.userId, params.now)
    const allocations = buildReservationAllocations(snapshot, requestedCredits)
    const metadata = sanitizeMetadata({
      ...params.metadata,
      operation: params.operation,
      route: params.route,
      provider: params.provider,
      model: params.model,
    })

    const createdReservations = await Promise.all(
      allocations.map(async (allocation) => {
        const record = await tx.billingRecord.create({
          data: {
            tenantId: params.tenantId,
            userId: params.userId,
            category: BillingRecordCategory.AI_CREDIT_USAGE,
            status: BillingRecordStatus.PENDING,
            description: `${params.description} (${allocation.credits} credits from ${describeAICreditSource(allocation.source)})`,
            amountCents: 0,
            currency: "USD",
            quantity: allocation.credits,
            pricingModel: "ai-credit-usage",
            aiCreditSource: allocation.source,
            aiCreditsDelta: allocation.credits * -1,
            metadata,
          },
        })

        return {
          reservationId: record.id,
          credits: allocation.credits,
          source: allocation.source,
        }
      }),
    )

    return {
      requestedCredits,
      allocations: createdReservations,
      snapshot,
    }
  })
}

export async function finalizeAICreditReservation(reservationIds: string[]) {
  if (reservationIds.length === 0) {
    return
  }

  await db.billingRecord.updateMany({
    where: {
      id: { in: reservationIds },
      category: BillingRecordCategory.AI_CREDIT_USAGE,
      status: BillingRecordStatus.PENDING,
    },
    data: {
      status: BillingRecordStatus.PAID,
      paidAt: new Date(),
    },
  })
}

export async function voidAICreditReservation(reservationIds: string[]) {
  if (reservationIds.length === 0) {
    return
  }

  await db.billingRecord.updateMany({
    where: {
      id: { in: reservationIds },
      category: BillingRecordCategory.AI_CREDIT_USAGE,
      status: BillingRecordStatus.PENDING,
    },
    data: {
      status: BillingRecordStatus.VOIDED,
    },
  })
}

export async function runWithReservedAICredits<T>(params: RunWithReservedAICreditsParams<T>) {
  const reservation = await reserveAICredits(params)
  const reservationIds = reservation.allocations.map((allocation) => allocation.reservationId)

  try {
    const result = await params.execute()
    const shouldFinalize = params.shouldFinalize ? params.shouldFinalize(result) : true

    try {
      if (shouldFinalize) {
        await finalizeAICreditReservation(reservationIds)
      } else {
        await voidAICreditReservation(reservationIds)
      }
    } catch (reservationError) {
      logger.error("AI credit reservation finalization failed", {
        error: reservationError,
        reservationIds,
        operation: params.operation,
        route: params.route,
      })
    }

    return result
  } catch (error) {
    try {
      await voidAICreditReservation(reservationIds)
    } catch (reservationError) {
      logger.error("AI credit reservation void failed", {
        error: reservationError,
        reservationIds,
        operation: params.operation,
        route: params.route,
      })
    }

    throw error
  }
}