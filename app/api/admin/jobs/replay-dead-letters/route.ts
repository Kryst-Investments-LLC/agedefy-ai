import { OrchestrationJobQueue } from "@prisma/client"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { logAudit } from "@/lib/audit"
import { authOptions } from "@/lib/auth"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { replayDeadLetterJobs } from "@/lib/jobs/queue"
import { requireAuthWithRole } from "@/lib/rbac"
import { requireRecentMfa } from "@/lib/security/recent-mfa"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

const bodySchema = z.object({
  queue: z.nativeEnum(OrchestrationJobQueue).optional(),
  jobIds: z.array(z.string()).max(1000).optional(),
})

/**
 * POST /api/admin/jobs/replay-dead-letters
 * Bulk-replay this tenant's DEAD_LETTER jobs (optionally scoped to a queue or a
 * list of ids) with a fresh retry budget. ADMIN + recent MFA required.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  const authResult = requireAuthWithRole(session, "ADMIN")
  if (authResult instanceof NextResponse) return authResult
  const mfaRequired = await requireRecentMfa(authResult.user.id)
  if (mfaRequired) return mfaRequired

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: authResult.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: authResult.user.id,
    requestFingerprint: createIdempotencyFingerprint({
      actorUserId: authResult.user.id,
      action: "replay-dead-letters",
      ...parsed.data,
    }),
    execute: async () => {
      const replayed = await replayDeadLetterJobs({
        tenantId: tenantContext.tenantId,
        queue: parsed.data.queue,
        jobIds: parsed.data.jobIds,
      })

      await logAudit({
        actorUserId: authResult.user.id,
        actorEmail: authResult.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: "admin.jobs.dead_letters_replayed",
        entityType: "OrchestrationJob",
        entityId: tenantContext.tenantId,
        details: { queue: parsed.data.queue ?? "all", replayed },
      })

      return { status: 200, body: { replayed } }
    },
  })
}
