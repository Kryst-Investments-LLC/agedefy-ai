import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { cancelOrchestrationJob } from "@/lib/jobs/queue"
import { requireAuthWithRole } from "@/lib/rbac"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { adminCancelOrRetryJobRequestSchema } from "@/lib/validators/jobs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json().catch(() => null)
  const parsed = adminCancelOrRetryJobRequestSchema.safeParse(body ?? {})

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await context.params
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: authResult.user.id,
    requestFingerprint: createIdempotencyFingerprint({
      actorUserId: authResult.user.id,
      jobId: id,
      action: "cancel",
      reason: parsed.data.reason,
    }),
    execute: async () => {
      const job = await cancelOrchestrationJob(id, tenantContext.tenantId)

      await logAudit({
        actorUserId: authResult.user.id,
        actorEmail: authResult.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "admin.jobs.canceled",
        entityType: "OrchestrationJob",
        entityId: job.id,
        details: {
          queue: job.queue,
          jobType: job.jobType,
          reason: parsed.data.reason,
        },
      })

      return { status: 200, body: job }
    },
  })
}