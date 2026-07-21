import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { db } from '@/lib/db'
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency'
import { applyRateLimit } from '@/lib/rate-limit'
import { checkUserInteractions } from '@/lib/safety/interaction-checker'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import { medicationCreateSchema } from '@/lib/validators/medication'
import { withHttpMetrics } from '@/lib/observability/with-http-metrics'

export const GET = withHttpMetrics('/api/medications', medicationsGetHandler)

async function medicationsGetHandler(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('active') !== 'false'

  const medications = await db.medication.findMany({
    where: { userId: session.user.id, ...(activeOnly ? { active: true } : {}) },
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })

  return NextResponse.json({ medications })
}

export const POST = withHttpMetrics('/api/medications', medicationsPostHandler)

async function medicationsPostHandler(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 15, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const consentBlocked = await requireGdprConsent(session.user.id, ['data-processing'])
  if (consentBlocked) return consentBlocked

  const body = await request.json().catch(() => null)
  const parsed = medicationCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: 'Forbidden: invalid tenant' }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, ...parsed.data }),
    execute: async () => {
      const medication = await db.medication.create({
        data: {
          userId: session.user.id,
          tenantId: tenantContext.tenantId,
          name: parsed.data.name,
          dosage: parsed.data.dosage,
          frequency: parsed.data.frequency,
          prescribedFor: parsed.data.prescribedFor,
          category: parsed.data.category,
          notes: parsed.data.notes,
        },
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        tenantId: tenantContext.tenantId,
        action: 'medication.created',
        entityType: 'Medication',
        entityId: medication.id,
        details: { name: medication.name, category: medication.category },
      })

      // Run safety check after adding a new medication
      const safetyResult = await checkUserInteractions(session.user.id, tenantContext.tenantId)

      return {
        status: 201,
        body: {
          medication,
          safetyCheck: {
            flagCount: safetyResult.flags.length,
            flags: safetyResult.flags,
            clinicianTasksCreated: safetyResult.clinicianTaskIds.length,
          },
        },
      }
    },
  })
}
