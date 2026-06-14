import { z } from "zod"

export const orchestrationJobQueueSchema = z.enum(["AI", "INGESTION", "NOTIFICATION", "GOVERNANCE"])
export const orchestrationJobStatusSchema = z.enum(["QUEUED", "LEASED", "SUCCEEDED", "FAILED", "DEAD_LETTER", "CANCELED"])

export const notificationJobPayloadSchema = z.object({
  notificationId: z.string().min(1),
  recipientUserId: z.string().min(1).nullable(),
  type: z.string().nullable(),
  title: z.string().min(1),
  body: z.string().min(1),
  actionUrl: z.string().nullable(),
  channels: z.array(z.string().min(1)).min(1),
})

export const aiGovernanceAuditJobPayloadSchema = z.object({
  provider: z.enum(["openai", "anthropic", "grok"]),
  model: z.string().min(1),
  route: z.string().min(1),
  requestId: z.string().min(1),
  queryLength: z.number().int().min(0),
  maxResults: z.number().int().min(1).max(25).optional(),
  tenantId: z.string().min(1),
  organizationId: z.string().optional(),
  outcome: z.enum(["success", "rejected", "error"]),
  providerRequestCostUsd: z.number().nonnegative().optional(),
  actor: z.object({
    userId: z.string().optional(),
    userEmail: z.string().nullable().optional(),
    role: z.string().optional(),
    tenantId: z.string().optional(),
    organizationId: z.string().optional(),
  }),
})

export const governanceReviewJobPayloadSchema = z.object({
  title: z.string().min(1).max(300),
  category: z.string().min(1).max(120),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  details: z.string().min(1).max(4000),
  relatedEntityType: z.string().min(1).max(120).optional(),
  relatedEntityId: z.string().min(1).max(120).optional(),
  actorUserId: z.string().optional(),
  actorEmail: z.string().optional(),
  tenantId: z.string().min(1),
})

export const researchIngestionMaterializeJobPayloadSchema = z.object({
  collectionId: z.string().min(1),
  query: z.string().min(1),
  actorUserId: z.string().min(1),
  actorEmail: z.string().nullable().optional(),
  tenantId: z.string().min(1),
  organizationId: z.string().optional(),
})

const adminNotificationJobInputSchema = z.object({
  queue: z.literal("NOTIFICATION"),
  jobType: z.literal("notification.marketplace.dispatch"),
  payload: notificationJobPayloadSchema,
})

const adminGovernanceReviewJobInputSchema = z.object({
  queue: z.literal("GOVERNANCE"),
  jobType: z.literal("governance.review.escalation"),
  payload: governanceReviewJobPayloadSchema.omit({ tenantId: true }),
})

const adminResearchIngestionJobInputSchema = z.object({
  queue: z.literal("INGESTION"),
  jobType: z.literal("ingestion.research.materialize"),
  payload: researchIngestionMaterializeJobPayloadSchema.omit({ tenantId: true, organizationId: true }),
})

const adminAIGovernanceAuditJobInputSchema = z.object({
  queue: z.literal("AI"),
  jobType: z.literal("ai.governance.audit"),
  payload: aiGovernanceAuditJobPayloadSchema.omit({ tenantId: true, organizationId: true, actor: true }).extend({
    actor: aiGovernanceAuditJobPayloadSchema.shape.actor.partial().optional(),
  }),
})

export const adminEnqueueOrchestrationJobSchema = z.discriminatedUnion("jobType", [
  adminAIGovernanceAuditJobInputSchema,
  adminResearchIngestionJobInputSchema,
  adminNotificationJobInputSchema,
  adminGovernanceReviewJobInputSchema,
]).and(z.object({
  dedupeKey: z.string().min(1).max(191).optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  maxAttempts: z.number().int().min(1).max(25).optional(),
  availableAt: z.string().datetime().optional(),
  correlationId: z.string().min(1).max(120).optional(),
  parentJobId: z.string().min(1).max(120).optional(),
}))

export const adminCancelOrRetryJobRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
})

export const chemistryRealityCheckJobPayloadSchema = z.object({
  aeonForgeCandidateId: z.string().min(1),
  moleculeId: z.string().min(1),
  smiles: z.string().min(1),
})