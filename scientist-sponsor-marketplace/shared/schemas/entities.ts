import { z } from "zod"

import { DISCOVERY_CATEGORIES, DISCOVERY_STAGES, MARKETPLACE_ENTITY_NAMES, MARKETPLACE_ROLES } from "@/scientist-sponsor-marketplace/shared/constants"

const isoDate = z.string().min(1)
const roleSchema = z.enum(MARKETPLACE_ROLES)
const attachmentSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  contentType: z.string().optional(),
})

export const scientistSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  displayName: z.string().min(2),
  institution: z.string().nullable(),
  specialty: z.string().nullable(),
  biography: z.string().nullable(),
  categories: z.array(z.string().min(1)).default([]),
  fundingStage: z.string().min(1),
  reputationScore: z.number().min(0).max(1),
  evidenceCount: z.number().int().min(0),
  publishedDiscoveryCount: z.number().int().min(0),
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const sponsorSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  organizationName: z.string().min(2),
  organizationType: z.string().min(1),
  thesis: z.string().min(10),
  preferredCategories: z.array(z.string().min(1)).default([]),
  preferredStages: z.array(z.string().min(1)).default([]),
  maxBudgetCents: z.number().int().positive(),
  minImpactScore: z.number().min(0).max(1),
  capitalAvailableCents: z.number().int().positive(),
  dueDiligenceLevel: z.string().min(1),
  geographyFocus: z.array(z.string().min(1)).default([]),
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const discoverySchema = z.object({
  id: z.string().cuid(),
  scientistId: z.string().cuid(),
  title: z.string().min(5),
  slug: z.string().min(3),
  category: z.string().min(1),
  summary: z.string().min(20),
  developmentStage: z.string().min(1),
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "PRIVATE", "ARCHIVED"]),
  scientificImpactScore: z.number().min(0).max(1),
  commercialReadiness: z.number().min(0).max(1),
  fundingGoalCents: z.number().int().positive(),
  currency: z.string().length(3),
  evidenceSummary: z.string().nullable(),
  evidenceLinks: z.array(z.object({ label: z.string(), url: z.string().url(), evidenceType: z.string().optional() })).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  publishedAt: isoDate.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const fundingRequestSchema = z.object({
  id: z.string().cuid(),
  discoveryId: z.string().cuid(),
  scientistId: z.string().cuid(),
  requestedAmountCents: z.number().int().positive(),
  currency: z.string().length(3),
  useOfFunds: z.string().min(10),
  timelineMonths: z.number().int().positive(),
  status: z.enum(["DRAFT", "OPEN", "DUE_DILIGENCE", "COMMITTED", "CLOSED"]),
  milestonePlan: z.array(z.object({ milestone: z.string().min(1), targetDate: isoDate, deliverable: z.string().min(1) })).default([]),
  evidenceUploads: z.array(z.object({ name: z.string().min(1), url: z.string().url(), kind: z.string().min(1) })).default([]),
  publishedAt: isoDate.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const matchScoreSchema = z.object({
  id: z.string().cuid(),
  discoveryId: z.string().cuid(),
  scientistId: z.string().cuid(),
  sponsorId: z.string().cuid(),
  overallScore: z.number().min(0).max(1),
  ruleBasedScore: z.number().min(0).max(1),
  aiAugmentedScore: z.number().min(0).max(1).nullable(),
  weightedBreakdown: z.object({
    categoryFit: z.number().min(0).max(1),
    budgetFit: z.number().min(0).max(1),
    impactFit: z.number().min(0).max(1),
    stageFit: z.number().min(0).max(1),
    evidenceFit: z.number().min(0).max(1),
    metadataFit: z.number().min(0).max(1),
    aiSignal: z.number().min(0).max(1),
  }),
  sponsorPreferenceFit: z.number().min(0).max(1),
  metadataFit: z.number().min(0).max(1),
  rationale: z.string().min(10),
  rank: z.number().int().positive().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const dealRoomSchema = z.object({
  id: z.string().cuid(),
  discoveryId: z.string().cuid(),
  scientistId: z.string().cuid(),
  sponsorId: z.string().cuid(),
  status: z.enum(["OPEN", "NEGOTIATING", "AGREEMENT_PENDING", "FUNDED", "CLOSED"]),
  ndaRequired: z.boolean(),
  ndaAcceptedAt: isoDate.nullable(),
  agreementStatus: z.enum(["DRAFT", "REVIEW", "APPROVED", "SIGNED"]),
  agreementTerms: z.record(z.string(), z.unknown()).default({}),
  documentVault: z.array(z.object({ name: z.string(), url: z.string().url(), access: z.string() })).default([]),
  lastActivityAt: isoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const messageThreadSchema = z.object({
  id: z.string().cuid(),
  dealRoomId: z.string().cuid(),
  senderUserId: z.string().cuid().nullable(),
  senderRole: roleSchema,
  messageType: z.enum(["MESSAGE", "DOCUMENT", "AGREEMENT", "PAYMENT", "SYSTEM"]),
  body: z.string().min(1),
  attachments: z.array(attachmentSchema).default([]),
  readAt: isoDate.nullable(),
  createdAt: isoDate,
})

export const transactionSchema = z.object({
  id: z.string().cuid(),
  dealRoomId: z.string().cuid(),
  discoveryId: z.string().cuid(),
  sponsorId: z.string().cuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  platformFeeCents: z.number().int().min(0),
  transactionFeeCents: z.number().int().min(0),
  payoutCents: z.number().int().min(0),
  status: z.enum(["PENDING", "AUTHORIZED", "SETTLED", "RELEASED", "FAILED", "REFUNDED"]),
  providerReference: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  paidAt: isoDate.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const marketplacePayoutReviewRejectionSchema = z.object({
  category: z.enum(["evidence_gap", "compliance", "milestone_scope", "documentation", "other"]),
  blockerSeverity: z.enum(["low", "medium", "high", "critical"]),
  rejectionNote: z.string().min(1),
  requiredFollowUpAction: z.string().min(1),
  reviewedAt: isoDate.nullable().optional(),
  reviewedBy: z.string().nullable().optional(),
})

export const auditLogSchema = z.object({
  id: z.string().cuid(),
  dealRoomId: z.string().cuid().nullable(),
  actorUserId: z.string().cuid().nullable(),
  actorRole: roleSchema,
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).default({}),
  createdAt: isoDate,
})

export const notificationSchema = z.object({
  id: z.string().cuid(),
  recipientUserId: z.string().cuid(),
  recipientRole: roleSchema,
  discoveryId: z.string().cuid().nullable(),
  dealRoomId: z.string().cuid().nullable(),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  actionUrl: z.string().nullable(),
  channels: z.array(z.string().min(1)).default(["in-app"]),
  status: z.enum(["QUEUED", "DELIVERED", "READ", "DISMISSED"]),
  createdAt: isoDate,
  readAt: isoDate.nullable(),
})

export const scientistCreateSchema = scientistSchema.omit({ id: true, createdAt: true, updatedAt: true })
export const sponsorCreateSchema = sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true })
export const discoveryCreateSchema = discoverySchema.omit({ id: true, slug: true, publishedAt: true, createdAt: true, updatedAt: true }).extend({
  category: z.enum(DISCOVERY_CATEGORIES).or(z.string().min(1)),
  developmentStage: z.enum(DISCOVERY_STAGES).or(z.string().min(1)),
})
export const fundingRequestCreateSchema = fundingRequestSchema.omit({ id: true, publishedAt: true, createdAt: true, updatedAt: true })
export const matchScoreCreateSchema = matchScoreSchema.omit({ id: true, createdAt: true, updatedAt: true })
export const dealRoomCreateSchema = dealRoomSchema.omit({ id: true, ndaAcceptedAt: true, lastActivityAt: true, createdAt: true, updatedAt: true })
export const messageThreadCreateSchema = messageThreadSchema.omit({ id: true, readAt: true, createdAt: true })
export const transactionCreateSchema = transactionSchema.omit({ id: true, providerReference: true, paidAt: true, createdAt: true, updatedAt: true })
export const auditLogCreateSchema = auditLogSchema.omit({ id: true, createdAt: true })
export const notificationCreateSchema = notificationSchema.omit({ id: true, createdAt: true, readAt: true })

export const scientistUpdateSchema = scientistCreateSchema.partial()
export const sponsorUpdateSchema = sponsorCreateSchema.partial()
export const discoveryUpdateSchema = discoveryCreateSchema.partial().extend({ slug: z.string().optional(), publishedAt: isoDate.nullable().optional(), status: z.enum(["DRAFT", "REVIEW", "PUBLISHED", "PRIVATE", "ARCHIVED"]).optional() })
export const fundingRequestUpdateSchema = fundingRequestCreateSchema.partial().extend({ publishedAt: isoDate.nullable().optional() })
export const matchScoreUpdateSchema = matchScoreCreateSchema.partial()
export const dealRoomUpdateSchema = dealRoomCreateSchema.partial().extend({ ndaAcceptedAt: isoDate.nullable().optional(), lastActivityAt: isoDate.optional() })
export const messageThreadUpdateSchema = messageThreadCreateSchema.partial().extend({ readAt: isoDate.nullable().optional() })
export const transactionUpdateSchema = transactionCreateSchema.partial().extend({ providerReference: z.string().nullable().optional(), paidAt: isoDate.nullable().optional(), status: z.enum(["PENDING", "AUTHORIZED", "SETTLED", "RELEASED", "FAILED", "REFUNDED"]).optional() })
export const auditLogUpdateSchema = auditLogCreateSchema.partial()
export const notificationUpdateSchema = notificationCreateSchema.partial().extend({ readAt: isoDate.nullable().optional(), status: z.enum(["QUEUED", "DELIVERED", "READ", "DISMISSED"]).optional() })

export const entityCreateSchemas = {
  scientists: scientistCreateSchema,
  sponsors: sponsorCreateSchema,
  discoveries: discoveryCreateSchema,
  fundingRequests: fundingRequestCreateSchema,
  matchScores: matchScoreCreateSchema,
  dealRooms: dealRoomCreateSchema,
  messageThreads: messageThreadCreateSchema,
  transactions: transactionCreateSchema,
  auditLogs: auditLogCreateSchema,
  notifications: notificationCreateSchema,
} as const

export const entityUpdateSchemas = {
  scientists: scientistUpdateSchema,
  sponsors: sponsorUpdateSchema,
  discoveries: discoveryUpdateSchema,
  fundingRequests: fundingRequestUpdateSchema,
  matchScores: matchScoreUpdateSchema,
  dealRooms: dealRoomUpdateSchema,
  messageThreads: messageThreadUpdateSchema,
  transactions: transactionUpdateSchema,
  auditLogs: auditLogUpdateSchema,
  notifications: notificationUpdateSchema,
} as const

export const entityNameSchema = z.enum(MARKETPLACE_ENTITY_NAMES)
export const marketplaceRoleSchema = roleSchema
