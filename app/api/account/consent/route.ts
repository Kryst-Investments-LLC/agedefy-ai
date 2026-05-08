import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildApiCanonicalEventContext } from '@/lib/events/api-context'
import { consentGrantRecordToEvent } from '@/lib/events/ingestion'
import { PrismaTransactionalHealthEventIngestionService } from '@/lib/events/transactional-ingestion-service'
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { consentMutationSchema, GDPR_CONSENT_CATEGORIES } from '@/lib/validators/workspace'

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const consent = await db.userConsentGrant.findUnique({
    where: { userId: session.user.id },
  })

  if (!consent) {
    return NextResponse.json({
      hasConsent: false,
      gdprConsents: GDPR_CONSENT_CATEGORIES.map((category) => ({
        category,
        granted: false,
        grantedAt: null,
      })),
      scopes: [],
      status: null,
      policyVersion: null,
      consentVersion: null,
    })
  }

  return NextResponse.json({
    hasConsent: true,
    id: consent.id,
    status: consent.status,
    scopes: consent.scopes,
    gdprConsents: consent.gdprConsents ?? GDPR_CONSENT_CATEGORIES.map((category) => ({
      category,
      granted: false,
      grantedAt: null,
    })),
    consentVersion: consent.consentVersion,
    legalBasis: consent.legalBasis,
    policyVersion: consent.policyVersion,
    effectiveAt: consent.effectiveAt,
    expiresAt: consent.expiresAt,
    revokedAt: consent.revokedAt,
    updatedAt: consent.updatedAt,
  })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  const parsedPayload = consentMutationSchema.safeParse(payload)

  if (!parsedPayload.success) {
    return NextResponse.json({ error: 'Invalid consent payload', details: parsedPayload.error.flatten() }, { status: 400 })
  }

  const existing = await db.userConsentGrant.findUnique({ where: { userId: session.user.id } })
  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })
  const action = !existing
    ? 'granted'
    : parsedPayload.data.status === 'revoked'
      ? 'revoked'
      : existing.status === 'revoked'
        ? 'granted'
        : 'updated'

  const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
  const eventContext = buildApiCanonicalEventContext(session, request)

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, payload: parsedPayload.data }),
    execute: async () => {
      const { result: consentGrant } = await ingestionService.ingestMutation(async (tx) => {
        const consentGrant = await tx.userConsentGrant.upsert({
          where: { userId: session.user.id },
          create: {
            userId: session.user.id,
            status: parsedPayload.data.status,
            legalBasis: parsedPayload.data.legalBasis,
            scopes: toInputJson(parsedPayload.data.scopes),
            gdprConsents: parsedPayload.data.gdprConsents ? toInputJson(parsedPayload.data.gdprConsents) : undefined,
            consentVersion: parsedPayload.data.consentVersion ?? 1,
            effectiveAt: parsedPayload.data.effectiveAt ? new Date(parsedPayload.data.effectiveAt) : new Date(),
            expiresAt: parsedPayload.data.expiresAt ? new Date(parsedPayload.data.expiresAt) : null,
            revokedAt: parsedPayload.data.status === 'revoked' ? new Date() : null,
            revocationReason: parsedPayload.data.revocationReason,
            policyVersion: parsedPayload.data.policyVersion,
          },
          update: {
            status: parsedPayload.data.status,
            legalBasis: parsedPayload.data.legalBasis,
            scopes: toInputJson(parsedPayload.data.scopes),
            gdprConsents: parsedPayload.data.gdprConsents ? toInputJson(parsedPayload.data.gdprConsents) : undefined,
            consentVersion: parsedPayload.data.consentVersion ?? existing?.consentVersion ?? 1,
            effectiveAt: parsedPayload.data.effectiveAt ? new Date(parsedPayload.data.effectiveAt) : existing?.effectiveAt ?? new Date(),
            expiresAt: parsedPayload.data.expiresAt ? new Date(parsedPayload.data.expiresAt) : null,
            revokedAt: parsedPayload.data.status === 'revoked' ? new Date() : null,
            revocationReason: parsedPayload.data.revocationReason,
            policyVersion: parsedPayload.data.policyVersion,
          },
        })

        return {
          result: consentGrant,
          event: consentGrantRecordToEvent(consentGrant, eventContext, action),
        }
      })

      return {
        status: 200,
        body: {
          id: consentGrant.id,
          status: consentGrant.status,
          scopes: consentGrant.scopes,
          policyVersion: consentGrant.policyVersion,
          updatedAt: consentGrant.updatedAt,
        },
      }
    },
  })
}