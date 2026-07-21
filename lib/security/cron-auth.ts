import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest()
}

/**
 * Authenticate an internal scheduler request with a constant-time comparison.
 * Missing configuration and invalid credentials deliberately share the same
 * external response so deployment details are not disclosed.
 */
export function requireCronAuthorization(request: Request): NextResponse | null {
  const configuredSecret = process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get("authorization") ?? ""
  const expected = configuredSecret ? `Bearer ${configuredSecret}` : ""
  const authorized = Boolean(configuredSecret) && timingSafeEqual(
    digest(authorization),
    digest(expected),
  )

  if (authorized) return null
  if (!configuredSecret) logger.error("cron.auth.secret_missing")
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
