import { NextResponse } from "next/server"
import { z } from "zod"

import { applyRateLimit } from "@/lib/rate-limit"
import { consumeEmailVerificationToken } from "@/lib/services/email-service"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logger } from "@/lib/logger"

const schema = z.object({
  token: z.string().min(1),
})

export async function POST(request: Request) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const body = await request.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    )
  }

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: `public:verify-email:${parsed.data.token}`,
    actorUserId: parsed.data.token,
    requestFingerprint: createIdempotencyFingerprint({ token: parsed.data.token }),
    execute: async () => {
      const result = await consumeEmailVerificationToken(parsed.data.token)

      if (!result) {
        return { status: 400, body: { error: "Invalid or expired verification token" } }
      }

      const user = await db.user.update({
        where: { email: result.email },
        data: { emailVerified: new Date() },
      })

      await logAudit({
        actorUserId: user.id,
        actorEmail: user.email,
        action: "auth.email_verified",
        entityType: "User",
        entityId: user.id,
      })

      logger.info("Email verified", { userId: user.id })

      return { status: 200, body: { message: "Email verified successfully." } }
    },
  })
}
