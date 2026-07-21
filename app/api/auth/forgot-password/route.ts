import { NextResponse } from "next/server"
import { z } from "zod"

import { applyRateLimit } from "@/lib/rate-limit"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/services/email-service"
import { logger } from "@/lib/logger"

const schema = z.object({
  email: z.string().trim().email(),
})

export async function POST(request: Request) {
  const blocked = await applyRateLimit(request, { maxRequests: 3, windowMs: 60_000 })
  if (blocked) return blocked

  const body = await request.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    // Always return 200 to prevent email enumeration
    return NextResponse.json({ message: "If an account with that email exists, a reset link has been sent." })
  }

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: `public:${parsed.data.email.toLowerCase()}`,
    actorUserId: parsed.data.email.toLowerCase(),
    requestFingerprint: createIdempotencyFingerprint({ email: parsed.data.email.toLowerCase() }),
    execute: async () => {
      const result = await createPasswordResetToken(parsed.data.email)

      if (result) {
        await sendPasswordResetEmail(result.email, result.plainToken)
        logger.info("Password reset requested", { userId: result.userId })
      }

      return { status: 200, body: { message: "If an account with that email exists, a reset link has been sent." } }
    },
  })
}
