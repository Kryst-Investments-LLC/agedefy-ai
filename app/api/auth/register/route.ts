import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

import { isConfiguredAdminEmail } from "@/lib/admin"
import { logAudit } from "@/lib/audit"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"
import { registerSchema } from "@/lib/validators/auth"
import { createEmailVerificationToken, sendWelcomeEmail, sendEmailVerification } from "@/lib/services/email-service"

export async function POST(request: Request) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const payload = await request.json()
  const parsedPayload = registerSchema.safeParse(payload)

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error: "Invalid registration data",
        details: parsedPayload.error.flatten(),
      },
      { status: 400 },
    )
  }

  const { email, name, password } = parsedPayload.data
  const normalizedEmail = email.toLowerCase()

  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existingUser) {
    // Return generic message to prevent email enumeration
    return NextResponse.json({ error: "Registration failed. Please try again or use a different email." }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: `public:${normalizedEmail}`,
    actorUserId: normalizedEmail,
    requestFingerprint: createIdempotencyFingerprint({ email: normalizedEmail, name }),
    execute: async () => {
      const user = await db.user.create({
        data: {
          email: normalizedEmail,
          name,
          passwordHash,
          role: isConfiguredAdminEmail(normalizedEmail) ? "ADMIN" : undefined,
          profile: {
            create: {
              longevityGoal: "Establish baseline",
            },
          },
        },
      })

      await logAudit({
        actorUserId: user.id,
        actorEmail: user.email,
        action: "auth.register",
        entityType: "User",
        entityId: user.id,
        details: { role: user.role },
      })

      logger.info("User registered", { userId: user.id, role: user.role })

      sendWelcomeEmail(user.email, user.name ?? "there").catch(() => {})
      createEmailVerificationToken(user.email)
        .then((result) => {
          if (result) sendEmailVerification(result.email, result.plainToken).catch(() => {})
        })
        .catch(() => {})

      return {
        status: 201,
        body: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      }
    },
  })
}