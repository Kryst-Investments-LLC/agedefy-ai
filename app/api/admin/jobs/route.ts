import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { listOrchestrationJobs } from "@/lib/jobs/queue"
import { requireAuthWithRole } from "@/lib/rbac"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { orchestrationJobAdminQuerySchema } from "@/lib/validators/enterprise"
import { adminEnqueueOrchestrationJobSchema } from "@/lib/validators/jobs"
import { requireRecentMfa } from "@/lib/security/recent-mfa"

function buildAdminManagedJobPayload(
  parsed: typeof adminEnqueueOrchestrationJobSchema._type,
  context: {
    tenantId: string
    organizationId?: string
    actorUserId: string
    actorEmail?: string | null
    actorRole?: string | null
  },
) {
  switch (parsed.jobType) {
    case "ai.governance.audit":
      return {
        ...parsed.payload,
        tenantId: context.tenantId,
        organizationId: context.organizationId,
        actor: {
          ...parsed.payload.actor,
          tenantId: context.tenantId,
          organizationId: context.organizationId,
          role: parsed.payload.actor?.role ?? context.actorRole ?? undefined,
          userId: parsed.payload.actor?.userId ?? context.actorUserId,
          userEmail: parsed.payload.actor?.userEmail ?? context.actorEmail ?? undefined,
        },
      }
    case "ingestion.research.materialize":
      return {
        ...parsed.payload,
        tenantId: context.tenantId,
        organizationId: context.organizationId,
        actorUserId: parsed.payload.actorUserId ?? context.actorUserId,
        actorEmail: parsed.payload.actorEmail ?? context.actorEmail ?? null,
      }
    case "governance.review.escalation":
      return {
        ...parsed.payload,
        tenantId: context.tenantId,
        actorUserId: parsed.payload.actorUserId ?? context.actorUserId,
        actorEmail: parsed.payload.actorEmail ?? context.actorEmail ?? undefined,
      }
    case "notification.marketplace.dispatch":
      return parsed.payload
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const parsed = orchestrationJobAdminQuerySchema.safeParse({
    queue: request.nextUrl.searchParams.get("queue") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    jobType: request.nextUrl.searchParams.get("jobType") ?? undefined,
    cursor: request.nextUrl.searchParams.get("cursor") ?? undefined,
    take: request.nextUrl.searchParams.get("take") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
  const jobs = await listOrchestrationJobs({
    tenantId: tenantContext.tenantId,
    ...parsed.data,
  })

  return NextResponse.json({
    items: jobs.items,
    nextCursor: jobs.nextCursor,
    tenantId: tenantContext.tenantId,
  })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult
  const mfaRequired = await requireRecentMfa(authResult.user.id)
  if (mfaRequired) return mfaRequired

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid job payload" }, { status: 400 })
  }

  const parsed = adminEnqueueOrchestrationJobSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: authResult.user.id,
    requestFingerprint: createIdempotencyFingerprint({ actorUserId: authResult.user.id, payload: parsed.data }),
    execute: async () => {
      const { enqueueOrchestrationJob } = await import("@/lib/jobs/queue")
      const payload = buildAdminManagedJobPayload(parsed.data, {
        tenantId: tenantContext.tenantId,
        organizationId: tenantContext.organizationId,
        actorUserId: authResult.user.id,
        actorEmail: authResult.user.email,
        actorRole: authResult.user.role,
      })
      const job = await enqueueOrchestrationJob({
        tenantId: tenantContext.tenantId,
        organizationId: tenantContext.organizationId,
        queue: parsed.data.queue,
        jobType: parsed.data.jobType,
        createdByUserId: authResult.user.id,
        payload,
        dedupeKey: parsed.data.dedupeKey,
        priority: parsed.data.priority,
        maxAttempts: parsed.data.maxAttempts,
        availableAt: parsed.data.availableAt ? new Date(parsed.data.availableAt) : undefined,
        correlationId: parsed.data.correlationId ?? (request.headers.get("x-correlation-id")?.trim() || undefined),
        parentJobId: parsed.data.parentJobId,
        requestId: request.headers.get("x-request-id")?.trim() || undefined,
      })

      await logAudit({
        actorUserId: authResult.user.id,
        actorEmail: authResult.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "admin.jobs.enqueued",
        entityType: "OrchestrationJob",
        entityId: job.id,
        details: {
          queue: job.queue,
          jobType: job.jobType,
          correlationId: job.correlationId,
          requestId: job.requestId,
        },
      })

      return { status: 201, body: job }
    },
  })
}
