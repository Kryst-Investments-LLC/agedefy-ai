import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import {
  createAdapterSchema,
  listAdaptersQuerySchema,
} from '@/lib/validators/external-screening'

/**
 * GET /api/screening-adapters
 * List the authenticated user's registered external screening adapters.
 * The secret field is masked in all responses.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = listAdaptersQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { enabled, limit } = parsed.data

  try {
    const adapters = await db.externalScreeningAdapter.findMany({
      where: {
        userId: session.user.id,
        ...(enabled !== undefined ? { enabled } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        endpointUrl: true,
        authHeader: true,
        authScheme: true,
        timeoutMs: true,
        enabled: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        // secret intentionally excluded
        _count: { select: { runs: true } },
      },
    })

    return NextResponse.json({ adapters })
  } catch (err) {
    logger.error('Failed to list screening adapters', { error: err, userId: session.user.id })
    return NextResponse.json({ error: 'Failed to list adapters' }, { status: 500 })
  }
}

/**
 * POST /api/screening-adapters
 * Register a new external screening adapter.
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) {
    return NextResponse.json({ error: 'Forbidden: invalid tenant' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const parsed = createAdapterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data

  try {
    const adapter = await db.externalScreeningAdapter.create({
      data: {
        userId: session.user.id,
        tenantId: tenantContext.tenantId,
        name: data.name,
        endpointUrl: data.endpointUrl,
        authHeader: data.authHeader,
        authScheme: data.authScheme,
        secret: data.secret,
        timeoutMs: data.timeoutMs,
        enabled: data.enabled,
        notes: data.notes,
      },
      select: {
        id: true,
        name: true,
        endpointUrl: true,
        authHeader: true,
        authScheme: true,
        timeoutMs: true,
        enabled: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        // secret intentionally excluded
      },
    })

    logger.info('External screening adapter registered', {
      adapterId: adapter.id,
      userId: session.user.id,
    })

    return NextResponse.json(adapter, { status: 201 })
  } catch (err) {
    logger.error('Failed to create screening adapter', { error: err, userId: session.user.id })
    return NextResponse.json({ error: 'Failed to create adapter' }, { status: 500 })
  }
}
