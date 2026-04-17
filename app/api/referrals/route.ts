/**
 * Referral System API
 *
 * POST — Create referral code (authenticated user generates their referral link)
 * GET  — List user's referrals + stats
 * PATCH — Claim referral code (referee links to referrer)
 *
 * @module app/api/referrals/route
 */

import { randomBytes } from 'crypto'
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { applyRateLimit } from '@/lib/rate-limit'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

const claimSchema = z.object({
  code: z.string().trim().min(6).max(20),
})

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function generateReferralCode(): string {
  // 6-char alphanumeric code, URL-safe
  return randomBytes(4).toString('base64url').slice(0, 6).toUpperCase()
}

/* ------------------------------------------------------------------ */
/*  GET — list user's referrals                                       */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request)
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const referrals = await db.referral.findMany({
    where: { referrerId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      code: true,
      status: true,
      rewardGranted: true,
      completedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  const stats = {
    total: referrals.length,
    completed: referrals.filter((r) => r.status === 'COMPLETED').length,
    pending: referrals.filter((r) => r.status === 'PENDING').length,
    rewardsEarned: referrals.filter((r) => r.rewardGranted).length,
  }

  return NextResponse.json({ referrals, stats })
}

/* ------------------------------------------------------------------ */
/*  POST — create referral code or claim one                          */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  // If body contains "code", this is a claim request
  if (body.code) {
    const parsed = claimSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid code', details: parsed.error.flatten() }, { status: 400 })
    }

    const referral = await db.referral.findUnique({
      where: { code: parsed.data.code },
    })

    if (!referral) {
      return NextResponse.json({ error: 'Referral code not found' }, { status: 404 })
    }

    if (referral.status !== 'PENDING') {
      return NextResponse.json({ error: 'Referral code already used' }, { status: 409 })
    }

    if (referral.referrerId === session.user.id) {
      return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 })
    }

    if (referral.expiresAt && new Date() > referral.expiresAt) {
      return NextResponse.json({ error: 'Referral code expired' }, { status: 410 })
    }

    const updated = await db.referral.update({
      where: { id: referral.id },
      data: {
        refereeId: session.user.id,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'referral.claimed',
      entityType: 'Referral',
      entityId: updated.id,
      details: JSON.stringify({ code: parsed.data.code, referrerId: referral.referrerId }),
    })

    return NextResponse.json({ referral: updated, message: 'Referral code claimed successfully' })
  }

  // Otherwise, create a new referral code
  // Check if user already has an active code
  const existing = await db.referral.findFirst({
    where: { referrerId: session.user.id, status: 'PENDING' },
  })

  if (existing) {
    return NextResponse.json({ referral: existing, message: 'Existing active referral code' })
  }

  let code = generateReferralCode()
  // Ensure uniqueness (unlikely collision but be safe)
  let retries = 5
  while (retries > 0) {
    const exists = await db.referral.findUnique({ where: { code } })
    if (!exists) break
    code = generateReferralCode()
    retries--
  }

  const referral = await db.referral.create({
    data: {
      referrerId: session.user.id,
      code,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      tenantId: tenantContext.tenantId,
    },
  })

  await logAudit({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    tenantId: tenantContext.tenantId,
    action: 'referral.created',
    entityType: 'Referral',
    entityId: referral.id,
    details: JSON.stringify({ code }),
  })

  return NextResponse.json({ referral }, { status: 201 })
}
