import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { enqueueOrchestrationJob } from "@/lib/jobs/queue"
import { logAudit } from "@/lib/audit"
import { searchPubMed, fetchPubMedSummaries, fetchPubMedAbstract } from "@/lib/research"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { researchIngestSchema } from "@/lib/validators/enterprise"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = researchIngestSchema.safeParse(body)

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
      const searchResult = await searchPubMed(query, maxResults)

      if (searchResult.pmids.length === 0) {
        return { status: 200, body: { message: "No results found", count: 0 } }
      }

      const summaries = await fetchPubMedSummaries(searchResult.pmids)

      const abstracts = await Promise.all(
        summaries.map((s) => fetchPubMedAbstract(s.pmid).catch(() => null)),
      )

      const collection = await db.researchCollection.create({
    data: {
      userId: session.user.id,
      name: collectionName,
      description: `PubMed search: "${query}"`,
      entries: {
        create: summaries.map((summary, index) => ({
          source: "PUBMED",
          externalId: summary.pmid,
          title: summary.title,
          authors: summary.authors,
          abstract: abstracts[index] ?? null,
          url: `https://pubmed.ncbi.nlm.nih.gov/${summary.pmid}/`,
          publishedAt: summary.publishedDate ? new Date(summary.publishedDate) : null,
        })),
      },
    },
    include: { entries: true },
  })

      const job = await enqueueOrchestrationJob({
    tenantId: tenantContext.tenantId,
    organizationId: tenantContext.organizationId,
    queue: "INGESTION",
    jobType: "ingestion.research.materialize",
    createdByUserId: session.user.id,
    dedupeKey: `research-ingest:${collection.id}`,
    requestId: request.headers.get("x-request-id")?.trim() || undefined,
    payload: {
      collectionId: collection.id,
      query,
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      tenantId: tenantContext.tenantId,
      organizationId: tenantContext.organizationId,
    },
  })

      await logAudit({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    tenantId: tenantContext.tenantId,
    action: "research.ingest.queued",
    entityType: "research_collection",
    entityId: collection.id,
    details: { query, resultCount: summaries.length, orchestrationJobId: job.id },
  })

      return {
        status: 202,
        body: {
          collectionId: collection.id,
          name: collection.name,
          entryCount: collection.entries.length,
          orchestrationJobId: job.id,
          status: "queued",
        },
      }
    },
  })
}
