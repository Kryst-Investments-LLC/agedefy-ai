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
import { listPageHeaders, overfetchTake, parseListPageParams, splitOverfetch } from '@/lib/http/pagination'
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

  const referrerId = session.user.id
  const { limit, offset } = parseListPageParams(new URL(request.url).searchParams, {
    defaultLimit: 50,
    maxLimit: 200,
  })

  // Page the list, but compute stats from DB aggregates so they cover ALL of the
  // user's referrals, not just the current page (P1-PERF-009).
  const [rows, statusGroups, rewardsEarned, total] = await Promise.all([
    db.referral.findMany({
      where: { referrerId },
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
      skip: offset,
      take: overfetchTake(limit),
    }),
    db.referral.groupBy({ by: ['status'], where: { referrerId }, _count: { _all: true } }),
    db.referral.count({ where: { referrerId, rewardGranted: true } }),
    db.referral.count({ where: { referrerId } }),
  ])

  const { items, hasMore } = splitOverfetch(rows, limit)
  const countFor = (status: string) =>
    statusGroups.find((g) => g.status === status)?._count._all ?? 0

  const stats = {
    total,
    completed: countFor('COMPLETED'),
    pending: countFor('PENDING'),
    rewardsEarned,
  }

  return NextResponse.json(
    { referrals: items, stats },
    { headers: listPageHeaders({ limit, offset, hasMore }) },
  )
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
