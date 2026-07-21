import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"
import { applyRateLimit } from "@/lib/rate-limit"

/**
 * Sink for client-side (React error boundary) errors so they actually reach the
 * server log — i.e. so "our team has been notified" is true. Unauthenticated (a
 * crash can happen before/after auth) but rate-limited and size-capped to avoid
 * log-spam abuse. Redaction of any sensitive fields is handled by the logger.
 */
function clamp(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  return value.slice(0, max)
}

export async function POST(request: Request) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>

  logger.error("client-error", {
    message: clamp(payload.message, 1000) ?? "(no message)",
    digest: clamp(payload.digest, 200),
    boundary: clamp(payload.boundary, 40),
    url: clamp(payload.url, 500),
    stack: clamp(payload.stack, 4000),
    userAgent: clamp(request.headers.get("user-agent") ?? undefined, 300),
  })

  return new NextResponse(null, { status: 204 })
}
