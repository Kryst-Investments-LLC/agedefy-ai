import { type OrchestrationJob, type Prisma } from "@prisma/client"

import { auditGovernedAIRequest } from "@/lib/ai/governance"
import { createReviewItem, logAudit } from "@/lib/audit"
import { createEvidenceDraft, estimateReviewConfidence } from "@/lib/biomedical-intelligence"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { materializeSnapshot } from "@/lib/loop/snapshot-materializer"
import { writeProtocolOutcome } from "@/lib/loop/outcome-writer"
import { sweepExpiredCycles } from "@/lib/loop/cycle-scheduler"
import { runReflectionAgent } from "@/lib/agents/reflection-agent"
import { candidateRealityCheckService } from "@/lib/services/candidate-reality-check"
import {
  aiGovernanceAuditJobPayloadSchema,
  chemistryRealityCheckJobPayloadSchema,
  cycleSweepJobPayloadSchema,
  governanceReviewJobPayloadSchema,
  loopObserveJobPayloadSchema,
  loopReflectJobPayloadSchema,
  notificationJobPayloadSchema,
  researchIngestionMaterializeJobPayloadSchema,
} from "@/lib/validators/jobs"
import { notificationsIntegration } from "@/scientist-sponsor-marketplace/backend/integrations/notificationsIntegration"

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

async function handleNotificationMarketplaceDispatch(job: OrchestrationJob) {
  const payload = notificationJobPayloadSchema.parse(job.payload)
  const notification = await db.marketplaceNotification.findUnique({
    where: { id: payload.notificationId },
  })

  if (!notification) {
    throw new Error(`Marketplace notification ${payload.notificationId} no longer exists`)
  }

  const recipient = payload.recipientUserId
    ? await db.user.findUnique({ where: { id: payload.recipientUserId }, select: { email: true, name: true } })
    : null

  const deliveries = await notificationsIntegration.dispatch(payload.channels, payload.title, payload.body, {
    recipientEmail: recipient?.email ?? null,
    recipientName: recipient?.name ?? null,
    actionUrl: payload.actionUrl,
    metadata: {
      notificationId: payload.notificationId,
      type: payload.type,
      jobId: job.id,
      tenantId: job.tenantId,
    },
  })

  const delivered = deliveries.some((entry) => entry.delivered)
  const updated = await db.marketplaceNotification.update({
    where: { id: payload.notificationId },
    data: {
      status: delivered ? "DELIVERED" : "QUEUED",
    },
  })

  await logAudit({
    actorUserId: job.createdByUserId ?? undefined,
    tenantId: job.tenantId,
    action: delivered ? "notification.dispatched" : "notification.dispatch.deferred",
    entityType: "MarketplaceNotification",
    entityId: updated.id,
    details: {
      channels: payload.channels,
      queue: job.queue,
      jobType: job.jobType,
      deliveries,
    },
  })

  return {
    notificationId: updated.id,
    delivered,
    deliveries,
  }
}

async function handleAIGovernanceAudit(job: OrchestrationJob) {
  const payload = aiGovernanceAuditJobPayloadSchema.parse(job.payload)

  await auditGovernedAIRequest(payload as Parameters<typeof auditGovernedAIRequest>[0])

  if (payload.outcome !== "success") {
    await createReviewItem({
      title: `AI governance review required: ${payload.provider}`,
      category: "ai-governance",
      severity: payload.outcome === "error" ? "HIGH" : "MEDIUM",
      details: `Governed AI request ${payload.requestId} ended with outcome ${payload.outcome} for model ${payload.model} on route ${payload.route}.`,
      relatedEntityType: "ai_request",
      relatedEntityId: payload.requestId,
    })
  }

  return {
    requestId: payload.requestId,
    outcome: payload.outcome,
  }
}

async function handleGovernanceReviewEscalation(job: OrchestrationJob) {
  const payload = governanceReviewJobPayloadSchema.parse(job.payload)

  const reviewItem = await createReviewItem({
    title: payload.title,
    category: payload.category,
    severity: payload.severity,
    details: payload.details,
    relatedEntityType: payload.relatedEntityType,
    relatedEntityId: payload.relatedEntityId,
  })

  await logAudit({
    actorUserId: payload.actorUserId,
    actorEmail: payload.actorEmail,
    tenantId: payload.tenantId,
    action: "governance.review.queued",
    entityType: "ReviewItem",
    entityId: reviewItem.id,
    details: {
      sourceJobId: job.id,
      category: payload.category,
      severity: payload.severity,
    },
  })

  return {
    reviewItemId: reviewItem.id,
  }
}

async function handleResearchIngestionMaterialization(job: OrchestrationJob) {
  const payload = researchIngestionMaterializeJobPayloadSchema.parse(job.payload)
  const collection = await db.researchCollection.findUnique({
    where: { id: payload.collectionId },
    include: { entries: true },
  })

  if (!collection) {
    throw new Error(`Research collection ${payload.collectionId} not found`)
  }

  let evidenceCreated = 0
  for (const entry of collection.entries) {
    const draft = createEvidenceDraft({
      title: entry.title,
      abstract: entry.abstract,
      sourceLabel: "PubMed ingestion",
      externalId: entry.externalId,
      sourceUrl: entry.url,
      researchEntryId: entry.id,
    })

    const dedupeConditions: Array<{ researchEntryId: string } | { externalId: string; sourceLabel: string }> = []
    if (draft.researchEntryId) {
      dedupeConditions.push({ researchEntryId: draft.researchEntryId })
    }
    if (draft.externalId) {
      dedupeConditions.push({ externalId: draft.externalId, sourceLabel: draft.sourceLabel })
    }

    const exists = await db.evidenceRecord.findFirst({
      where: { OR: dedupeConditions },
      select: { id: true },
    })

    if (exists) {
      continue
    }

    await db.evidenceRecord.create({
      data: {
        createdByUserId: payload.actorUserId,
        researchEntryId: draft.researchEntryId,
        title: draft.title,
        diseaseArea: draft.diseaseArea,
        sourceLabel: draft.sourceLabel,
        externalId: draft.externalId,
        sourceUrl: draft.sourceUrl,
        abstract: draft.abstract,
        populationSummary: draft.populationSummary,
        interventionSummary: draft.interventionSummary,
        outcomeSummary: draft.outcomeSummary,
        biomarkerTargets: JSON.stringify(draft.biomarkerTargets),
        contraindications: JSON.stringify(draft.contraindications),
        studyType: draft.studyType,
        evidenceDirection: draft.evidenceDirection,
        reviewStatus: "AUTO_QUEUED",
        provenanceType: "PUBMED_IMPORT",
        provenanceDetail: `Auto-extracted from PubMed ingest for query \"${payload.query}\".`,
        automationSource: "heuristic-evidence-extractor-v1",
        uncertaintyScore: draft.uncertaintyScore,
        reviewConfidence: estimateReviewConfidence({
          evidenceScore: draft.evidenceScore,
          uncertaintyScore: draft.uncertaintyScore,
          hasAbstract: Boolean(draft.abstract),
        }),
        sourceCapturedAt: new Date(),
        evidenceScore: draft.evidenceScore,
      },
    })
    evidenceCreated += 1
  }

  await logAudit({
    actorUserId: payload.actorUserId,
    actorEmail: payload.actorEmail ?? undefined,
    tenantId: payload.tenantId,
    action: "research.ingest.materialized",
    entityType: "research_collection",
    entityId: collection.id,
    details: {
      orchestrationJobId: job.id,
      evidenceCreated,
      entryCount: collection.entries.length,
      query: payload.query,
    },
  })

  if (evidenceCreated > 0) {
    await createReviewItem({
      title: `Research ingest review: ${collection.name}`,
      category: "research-ingestion",
      severity: "MEDIUM",
      details: `Research ingestion job ${job.id} created ${evidenceCreated} evidence records for collection ${collection.id}.`,
      relatedEntityType: "ResearchCollection",
      relatedEntityId: collection.id,
    })
  }

  return {
    collectionId: collection.id,
    evidenceCreated,
  }
}

async function handleChemistryRealityCheck(job: OrchestrationJob) {
  const payload = chemistryRealityCheckJobPayloadSchema.parse(job.payload)
  const realityCheck = await candidateRealityCheckService.check(payload.smiles)
  logger.info("Chemistry reality-check complete", {
    jobId: job.id,
    moleculeId: payload.moleculeId,
    status: realityCheck.status,
  })
  return realityCheck
}

async function handleLoopReflect(job: OrchestrationJob) {
  const payload = loopReflectJobPayloadSchema.parse(job.payload)
  const { cycleId, userId, tenantId } = payload

  // Write the outcome record before reflecting (idempotent)
  await writeProtocolOutcome(cycleId)

  const report = await runReflectionAgent({ loopCycleId: cycleId, userId, tenantId })

  if (!report) {
    await db.loopCycle.update({
      where: { id: cycleId },
      data: { status: "FAILED", failedReason: "reflection_agent_failed", completedAt: new Date() },
    })
    logger.warn("Loop REFLECT failed: reflection agent returned null", { cycleId, userId })
    return { cycleId, status: "failed", reason: "reflection_agent_failed" }
  }

  await db.loopCycle.update({
    where: { id: cycleId },
    data: { status: "COMPLETE", completedAt: new Date() },
  })

  logger.info("Loop REFLECT complete", { cycleId, reportId: report.reportId, userId })
  return { cycleId, reportId: report.reportId, status: "complete" }
}

async function handleLoopObserve(job: OrchestrationJob) {
  const payload = loopObserveJobPayloadSchema.parse(job.payload)
  const { cycleId, userId, tenantId } = payload

  const snapshot = await materializeSnapshot(userId, tenantId)

  if (!snapshot) {
    await db.loopCycle.update({
      where: { id: cycleId },
      data: { status: "FAILED", failedReason: "snapshot_materialization_failed", completedAt: new Date() },
    })
    logger.warn("Loop OBSERVE failed: could not materialize snapshot", { cycleId, userId })
    return { cycleId, status: "failed", reason: "snapshot_materialization_failed" }
  }

  await db.loopCycle.update({
    where: { id: cycleId },
    data: { status: "PLAN", snapshotId: snapshot.id },
  })

  logger.info("Loop OBSERVE complete", { cycleId, snapshotId: snapshot.id, userId })
  return { cycleId, snapshotId: snapshot.id, status: "plan" }
}

async function handleCycleSweep(job: OrchestrationJob) {
  const payload = cycleSweepJobPayloadSchema.parse(job.payload)
  logger.info("Cycle sweep started", { jobId: job.id, triggeredBy: payload.triggeredBy })
  const result = await sweepExpiredCycles()
  logger.info("Cycle sweep complete", { ...result })
  return result
}

export async function processOrchestrationJob(job: OrchestrationJob) {
  logger.info("Processing orchestration job", {
    jobId: job.id,
    tenantId: job.tenantId,
    queue: job.queue,
    jobType: job.jobType,
    attempts: job.attempts,
  })

  switch (job.jobType) {
    case "notification.marketplace.dispatch":
      return handleNotificationMarketplaceDispatch(job)
    case "ai.governance.audit":
      return handleAIGovernanceAudit(job)
    case "governance.review.escalation":
      return handleGovernanceReviewEscalation(job)
    case "ingestion.research.materialize":
      return handleResearchIngestionMaterialization(job)
    case "chemistry.reality-check":
      return handleChemistryRealityCheck(job)
    case "loop.observe":
      return handleLoopObserve(job)
    case "loop.reflect":
      return handleLoopReflect(job)
    case "loop.cycle-sweep":
      return handleCycleSweep(job)
    default:
      throw new Error(`No orchestration handler registered for job type ${job.jobType}`)
  }
}

export function serializeJobResult(value: unknown): Prisma.InputJsonValue {
  return toInputJson(value ?? { ok: true })
}