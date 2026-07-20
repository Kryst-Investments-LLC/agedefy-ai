import { NextResponse } from "next/server"

import { getMfaVerifiedAt } from "@/lib/mfa"

export const RECENT_MFA_MAX_AGE_MS = 10 * 60 * 1000

/** Require a server-recorded second-factor challenge within the allowed window. */
export async function requireRecentMfa(
  userId: string,
  options: { now?: Date; maxAgeMs?: number } = {},
): Promise<NextResponse | null> {
  const verifiedAt = await getMfaVerifiedAt(userId)
  const now = options.now ?? new Date()
  const maxAgeMs = options.maxAgeMs ?? RECENT_MFA_MAX_AGE_MS
  const ageMs = verifiedAt ? now.getTime() - verifiedAt.getTime() : Number.POSITIVE_INFINITY

  if (ageMs >= 0 && ageMs <= maxAgeMs) return null

  return NextResponse.json(
    {
      error: "Recent multi-factor authentication is required",
      code: "recent_mfa_required",
      maxAgeSeconds: Math.floor(maxAgeMs / 1000),
    },
    { status: 428 },
  )
}
