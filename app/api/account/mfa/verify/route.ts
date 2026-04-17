import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { applyRateLimit } from "@/lib/rate-limit"
import { verifyMfaToken, verifyBackupCode } from "@/lib/mfa"

// POST — Verify MFA token during login flow
export async function POST(req: NextRequest) {
  // Strict rate limit to prevent TOTP brute-force (10^6 possible codes)
  const blocked = await applyRateLimit(req, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

  return NextResponse.json({ verified: true })
}
