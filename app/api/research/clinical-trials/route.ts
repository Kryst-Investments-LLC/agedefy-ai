import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { createEvidenceDraft, estimateReviewConfidence } from "@/lib/biomedical-intelligence"
import { searchClinicalTrials } from "@/lib/clinical-trials"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

const ingestSchema = z.object({
  collectionName: z.string().min(1).max(200),
  query: z.string().min(2).max(500),
  maxResults: z.number().int().min(1).max(50).optional().default(10),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = ingestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { collectionName, query, maxResults } = parsed.data
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, collectionName, query, maxResults }),
    execute: async () => {
      const trials = await searchClinicalTrials(query, maxResults)

      if (trials.length === 0) {
        return { status: 200, body: { message: "No clinical trials found", count: 0 } }
      }

      const collection = await db.researchCollection.create({
    data: {
      userId: session.user.id,
      name: collectionName,
      description: `ClinicalTrials.gov search: "${query}"`,
      entries: {
        create: trials.map((trial) => ({
          source: "IMPORT",
          externalId: trial.nctId,
          title: trial.title,
          authors: `Status: ${trial.status}`,
          abstract: trial.conditions.join(", ") || null,
          url: trial.url,
          publishedAt: trial.startDate ? new Date(trial.startDate) : null,
        })),
      },
    },
    include: { entries: true },
  })

  const evidenceDrafts = collection.entries.map((entry) =>
    createEvidenceDraft({
      title: entry.title,
      abstract: entry.abstract,
      sourceLabel: "ClinicalTrials.gov ingestion",
      externalId: entry.externalId,
      sourceUrl: entry.url,
      researchEntryId: entry.id,
      populationSummary: entry.abstract,
      outcomeSummary: entry.authors,
    }),
  )

  let evidenceCreated = 0
  for (const draft of evidenceDrafts) {
    const dedupeConditions: Array<{ researchEntryId: string } | { externalId: string; sourceLabel: string }> = []

    if (draft.researchEntryId) {
      dedupeConditions.push({ researchEntryId: draft.researchEntryId })
    }

    if (draft.externalId) {
      dedupeConditions.push({ externalId: draft.externalId, sourceLabel: draft.sourceLabel })
    }

    const exists = await db.evidenceRecord.findFirst({
      where: {
        OR: dedupeConditions,
      },
      select: { id: true },
    })

    if (exists) {
      continue
    }

    await db.evidenceRecord.create({
      data: {
        createdByUserId: session.user.id,
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
        provenanceType: "CLINICAL_TRIAL_IMPORT",
        provenanceDetail: `Auto-extracted from ClinicalTrials.gov ingest for query \"${query}\".`,
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
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    action: "clinical_trials.ingest",
    entityType: "research_collection",
    entityId: collection.id,
    details: { query, resultCount: trials.length, evidenceCreated },
  })

  return {
    status: 200,
    body: {
      collectionId: collection.id,
      name: collection.name,
      entryCount: collection.entries.length,
      evidenceCreated,
    },
  }
    },
  })
}
