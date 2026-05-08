import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"

import { applyRateLimit } from "@/lib/rate-limit"
import { consumePasswordResetToken } from "@/lib/services/email-service"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logger } from "@/lib/logger"

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(12, "Password must be at least 12 characters"),
})

export async function POST(request: Request) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const body = await request.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: `public:password-reset:${parsed.data.token}`,
    actorUserId: parsed.data.token,
    requestFingerprint: createIdempotencyFingerprint({ token: parsed.data.token }),
    execute: async () => {
      const result = await consumePasswordResetToken(parsed.data.token)

      if (!result) {
        return { status: 400, body: { error: "Invalid or expired reset token" } }
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12)

      const user = await db.user.update({
        where: { email: result.email },
        data: { passwordHash },
      })

      await logAudit({
        actorUserId: user.id,
        actorEmail: user.email,
        action: "auth.password_reset",
        entityType: "User",
        entityId: user.id,
      })

      logger.info("Password reset completed", { userId: user.id })

      return { status: 200, body: { message: "Password has been reset. You can now sign in." } }
    },
  })
}
