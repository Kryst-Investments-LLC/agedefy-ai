import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { grantGdprConsents } from '@/lib/consent'
import { db } from '@/lib/db'
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency'
import { createRequestContext, withRequestContextHeaders } from '@/lib/observability/request-context'
import { applyRateLimit } from '@/lib/rate-limit'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { GDPR_CONSENT_CATEGORIES, type GdprConsentCategory } from '@/lib/validators/workspace'

const consentGrantSchema = z.object({
  categories: z.array(z.enum(GDPR_CONSENT_CATEGORIES as unknown as [string, ...string[]])).min(1),
  legalBasis: z.string().min(1).max(200).optional(),
  policyVersion: z.string().min(1).max(50).optional(),
})

const consentRevokeSchema = z.object({
  categories: z.array(z.enum(GDPR_CONSENT_CATEGORIES as unknown as [string, ...string[]])).min(1),
  reason: z.string().max(500).optional(),
})

/**
 * GET /api/consent — Read user's current consent grants
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const requestContext = createRequestContext(request, { session })

  if (!session?.user?.id) {
    return withRequestContextHeaders(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      requestContext,
    )
  }

  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return withRequestContextHeaders(blocked, requestContext)

  const consent = await db.userConsentGrant.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      status: true,
      gdprConsents: true,
      consentVersion: true,
      effectiveAt: true,
      expiresAt: true,
      revokedAt: true,
      policyVersion: true,
      updatedAt: true,
    },
  })

  return withRequestContextHeaders(
    NextResponse.json({
      consent: consent ?? null,
      availableCategories: GDPR_CONSENT_CATEGORIES,
    }),
    requestContext,
  )
}

/**
 * POST /api/consent — Grant or update consent categories
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const requestContext = createRequestContext(request, { session })

  if (!session?.user?.id) {
    return withRequestContextHeaders(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      requestContext,
    )
  }

  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return withRequestContextHeaders(blocked, requestContext)

  const payload = await request.json()
  const parsed = consentGrantSchema.safeParse(payload)
  if (!parsed.success) {
    return withRequestContextHeaders(
      NextResponse.json({ error: 'Invalid consent payload', details: parsed.error.flatten() }, { status: 400 }),
      requestContext,
    )
  }

  const { categories, legalBasis, policyVersion } = parsed.data
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ action: 'consent-grant', userId: session.user.id, categories }),
    execute: async () => {
      const consent = await grantGdprConsents(session.user.id, categories as GdprConsentCategory[], {
        legalBasis,
        policyVersion,
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: 'consent.granted',
        entityType: 'UserConsentGrant',
        entityId: consent.id,
        details: JSON.stringify({ categories, version: consent.consentVersion }),
      })

      return { status: 200, body: { consent, granted: categories } }
    },
  }).then((r) => withRequestContextHeaders(r, requestContext))
}

/**
 * DELETE /api/consent — Revoke specific consent categories
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const requestContext = createRequestContext(request, { session })

  if (!session?.user?.id) {
    return withRequestContextHeaders(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      requestContext,
    )
  }

  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return withRequestContextHeaders(blocked, requestContext)

  const payload = await request.json()
  const parsed = consentRevokeSchema.safeParse(payload)
  if (!parsed.success) {
    return withRequestContextHeaders(
      NextResponse.json({ error: 'Invalid revocation payload', details: parsed.error.flatten() }, { status: 400 }),
      requestContext,
    )
  }

  const { categories, reason } = parsed.data
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  const existing = await db.userConsentGrant.findUnique({
    where: { userId: session.user.id },
  })

  if (!existing) {
    return withRequestContextHeaders(
      NextResponse.json({ error: 'No consent record found' }, { status: 404 }),
      requestContext,
    )
  }

  const existingEntries = (existing.gdprConsents as Array<{ category: string; granted: boolean; grantedAt?: string }>) ?? []

  const updatedEntries = existingEntries.map((entry) => {
    if (categories.includes(entry.category as GdprConsentCategory)) {
      return { ...entry, granted: false }
    }
    return entry
  })

  const allRevoked = updatedEntries.every((e) => !e.granted)

  const consent = await db.userConsentGrant.update({
    where: { userId: session.user.id },
    data: {
      gdprConsents: updatedEntries,
      consentVersion: { increment: 1 },
      ...(allRevoked ? { status: 'revoked', revokedAt: new Date(), revocationReason: reason ?? 'user-initiated' } : {}),
    },
  })

  await logAudit({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? undefined,
    tenantId: tenantContext.tenantId,
    action: 'consent.revoked',
    entityType: 'UserConsentGrant',
    entityId: consent.id,
    details: JSON.stringify({ categories, reason, allRevoked }),
  })

  return withRequestContextHeaders(
    NextResponse.json({ consent, revoked: categories, allRevoked }),
    requestContext,
  )
}
