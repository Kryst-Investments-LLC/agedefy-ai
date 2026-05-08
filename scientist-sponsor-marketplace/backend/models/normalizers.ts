import type {
  AuditLog,
  DealRoom,
  Discovery,
  FundingRequest,
  MatchScore,
  MessageThread,
  Notification,
  Scientist,
  Sponsor,
  Transaction,
} from "@/scientist-sponsor-marketplace/shared/types/entities"

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asArrayOfObjects<T extends Record<string, unknown>>(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is T => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : []
}

function toIso(value: unknown) {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString() : String(value)
}

export function normalizeScientist(record: any): Scientist {
  return {
    id: record.id,
    userId: record.userId,
    displayName: record.displayName,
    institution: record.institution ?? null,
    specialty: record.specialty ?? null,
    biography: record.biography ?? null,
    categories: asStringArray(record.categories),
    fundingStage: record.fundingStage,
    reputationScore: record.reputationScore,
    evidenceCount: record.evidenceCount,
    publishedDiscoveryCount: record.publishedDiscoveryCount,
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(record.updatedAt) ?? new Date().toISOString(),
  }
}

export function normalizeSponsor(record: any): Sponsor {
  return {
    id: record.id,
    userId: record.userId,
    organizationName: record.organizationName,
    organizationType: record.organizationType,
    thesis: record.thesis,
    preferredCategories: asStringArray(record.preferredCategories),
    preferredStages: asStringArray(record.preferredStages),
    maxBudgetCents: record.maxBudgetCents,
    minImpactScore: record.minImpactScore,
    capitalAvailableCents: record.capitalAvailableCents,
    dueDiligenceLevel: record.dueDiligenceLevel,
    geographyFocus: asStringArray(record.geographyFocus),
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(record.updatedAt) ?? new Date().toISOString(),
  }
}

export function normalizeDiscovery(record: any): Discovery {
  return {
    id: record.id,
    scientistId: record.scientistId,
    title: record.title,
    slug: record.slug,
    category: record.category,
    summary: record.summary,
    developmentStage: record.developmentStage,
    status: record.status,
    scientificImpactScore: record.scientificImpactScore,
    commercialReadiness: record.commercialReadiness,
    fundingGoalCents: record.fundingGoalCents,
    currency: record.currency,
    evidenceSummary: record.evidenceSummary ?? null,
    evidenceLinks: asArrayOfObjects<{ label: string; url: string; evidenceType?: string }>(record.evidenceLinks).map((item) => ({
      label: String(item.label ?? "Evidence"),
      url: String(item.url ?? ""),
      evidenceType: typeof item.evidenceType === "string" ? item.evidenceType : undefined,
    })),
    metadata: asRecord(record.metadata),
    publishedAt: toIso(record.publishedAt),
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(record.updatedAt) ?? new Date().toISOString(),
  }
}

export function normalizeFundingRequest(record: any): FundingRequest {
  return {
    id: record.id,
    discoveryId: record.discoveryId,
    scientistId: record.scientistId,
    requestedAmountCents: record.requestedAmountCents,
    currency: record.currency,
    useOfFunds: record.useOfFunds,
    timelineMonths: record.timelineMonths,
    status: record.status,
    milestonePlan: asArrayOfObjects<{ milestone: string; targetDate: string; deliverable: string }>(record.milestonePlan).map((item) => ({
      milestone: String(item.milestone ?? "Milestone"),
      targetDate: String(item.targetDate ?? new Date().toISOString()),
      deliverable: String(item.deliverable ?? "Deliverable"),
    })),
    evidenceUploads: asArrayOfObjects<{ name: string; url: string; kind: string }>(record.evidenceUploads).map((item) => ({
      name: String(item.name ?? "Document"),
      url: String(item.url ?? ""),
      kind: String(item.kind ?? "attachment"),
    })),
    publishedAt: toIso(record.publishedAt),
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(record.updatedAt) ?? new Date().toISOString(),
  }
}

export function normalizeMatchScore(record: any): MatchScore {
  return {
    id: record.id,
    discoveryId: record.discoveryId,
    scientistId: record.scientistId,
    sponsorId: record.sponsorId,
    overallScore: record.overallScore,
    ruleBasedScore: record.ruleBasedScore,
    aiAugmentedScore: record.aiAugmentedScore ?? null,
    weightedBreakdown: {
      categoryFit: Number(record.weightedBreakdown?.categoryFit ?? 0),
      budgetFit: Number(record.weightedBreakdown?.budgetFit ?? 0),
      impactFit: Number(record.weightedBreakdown?.impactFit ?? 0),
      stageFit: Number(record.weightedBreakdown?.stageFit ?? 0),
      evidenceFit: Number(record.weightedBreakdown?.evidenceFit ?? 0),
      metadataFit: Number(record.weightedBreakdown?.metadataFit ?? 0),
      aiSignal: Number(record.weightedBreakdown?.aiSignal ?? 0),
    },
    sponsorPreferenceFit: record.sponsorPreferenceFit,
    metadataFit: record.metadataFit,
    rationale: record.rationale,
    rank: record.rank ?? null,
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(record.updatedAt) ?? new Date().toISOString(),
  }
}

export function normalizeDealRoom(record: any): DealRoom {
  return {
    id: record.id,
    discoveryId: record.discoveryId,
    scientistId: record.scientistId,
    sponsorId: record.sponsorId,
    status: record.status,
    ndaRequired: Boolean(record.ndaRequired),
    ndaAcceptedAt: toIso(record.ndaAcceptedAt),
    agreementStatus: record.agreementStatus,
    agreementTerms: asRecord(record.agreementTerms),
    documentVault: asArrayOfObjects<{ name: string; url: string; access: string }>(record.documentVault).map((item) => ({
      name: String(item.name ?? "Document"),
      url: String(item.url ?? ""),
      access: String(item.access ?? "restricted"),
    })),
    lastActivityAt: toIso(record.lastActivityAt) ?? new Date().toISOString(),
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(record.updatedAt) ?? new Date().toISOString(),
  }
}

export function normalizeMessageThread(record: any): MessageThread {
  return {
    id: record.id,
    dealRoomId: record.dealRoomId,
    senderUserId: record.senderUserId ?? null,
    senderRole: record.senderRole,
    messageType: record.messageType,
    body: record.body,
    attachments: asArrayOfObjects<{ name: string; url: string; contentType?: string }>(record.attachments).map((item) => ({
      name: String(item.name ?? "Attachment"),
      url: String(item.url ?? ""),
      contentType: typeof item.contentType === "string" ? item.contentType : undefined,
    })),
    readAt: toIso(record.readAt),
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
  }
}

export function normalizeTransaction(record: any): Transaction {
  return {
    id: record.id,
    dealRoomId: record.dealRoomId,
    discoveryId: record.discoveryId,
    sponsorId: record.sponsorId,
    amountCents: record.amountCents,
    currency: record.currency,
    platformFeeCents: record.platformFeeCents,
    transactionFeeCents: record.transactionFeeCents,
    payoutCents: record.payoutCents,
    status: record.status,
    providerReference: record.providerReference ?? null,
    metadata: asRecord(record.metadata),
    paidAt: toIso(record.paidAt),
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(record.updatedAt) ?? new Date().toISOString(),
  }
}

export function normalizeAuditLog(record: any): AuditLog {
  return {
    id: record.id,
    dealRoomId: record.dealRoomId ?? null,
    actorUserId: record.actorUserId ?? null,
    actorRole: record.actorRole,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId ?? null,
    ipAddress: record.ipAddress ?? null,
    details: asRecord(record.details),
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
  }
}

export function normalizeNotification(record: any): Notification {
  return {
    id: record.id,
    recipientUserId: record.recipientUserId,
    recipientRole: record.recipientRole,
    discoveryId: record.discoveryId ?? null,
    dealRoomId: record.dealRoomId ?? null,
    type: record.type,
    title: record.title,
    body: record.body,
    actionUrl: record.actionUrl ?? null,
    channels: asStringArray(record.channels),
    status: record.status,
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
    readAt: toIso(record.readAt),
  }
}
