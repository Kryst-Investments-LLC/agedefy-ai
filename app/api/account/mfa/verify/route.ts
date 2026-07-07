import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { applyRateLimit, applyRateLimitByKey } from "@/lib/rate-limit"
import { verifyMfaToken, verifyBackupCode, recordMfaVerification } from "@/lib/mfa"

// POST — Verify MFA token during login flow
export async function POST(req: NextRequest) {
  // Strict rate limit to prevent TOTP brute-force (10^6 possible codes)
  const blocked = await applyRateLimit(req, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Per-user cap: brute-forcing a 6-digit TOTP is an attack on the caller's own
  // account, so key on userId — this cannot be sidestepped by rotating IPs.
  const userBlocked = await applyRateLimitByKey(`mfa-verify:${session.user.id}`, {
    maxRequests: 5,
    windowMs: 60_000,
  })
  if (userBlocked) return userBlocked

  const body = await req.json()
  const token = typeof body?.token === "string" ? body.token.trim() : ""
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 })
  }

  // Try TOTP first, then backup code
  let valid = false
  if (/^\d{6}$/.test(token)) {
    valid = await verifyMfaToken(session.user.id, token)
  }
  if (!valid) {
    valid = await verifyBackupCode(session.user.id, token)
  }

  if (!valid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 403 })
  }

  // Persist the verification server-side. The JWT callback reads this to lower
  // the MFA gate; the client's subsequent update() call cannot clear it without
  // this record existing and post-dating the session's login.
  await recordMfaVerification(session.user.id)

  return NextResponse.json({ verified: true })
}
