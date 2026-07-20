import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { encryptExternalSecret } from '@/lib/external-secret-crypto'
import { logger } from '@/lib/logger'
import { requireAuthWithRole } from '@/lib/rbac'
import { updateAdapterSchema } from '@/lib/validators/external-screening'

const SAFE_SELECT = {
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
  // secret intentionally excluded from all GET/PATCH responses
} as const

/**
 * GET /api/screening-adapters/[id]
 * Fetch a single adapter (secret masked).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, 'RESEARCHER', 'CLINICIAN', 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const adapter = await db.externalScreeningAdapter.findFirst({
      where: { id, userId: session.user.id },
      select: {
        ...SAFE_SELECT,
        _count: { select: { runs: true } },
      },
    })

    if (!adapter) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(adapter)
  } catch (err) {
    logger.error('Failed to fetch screening adapter', { error: err, id })
    return NextResponse.json({ error: 'Failed to fetch adapter' }, { status: 500 })
  }
}

/**
 * PATCH /api/screening-adapters/[id]
 * Partially update name, URL, secret, timeout, enabled, notes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, 'RESEARCHER', 'CLINICIAN', 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const parsed = updateAdapterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const existing = await db.externalScreeningAdapter.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updateData = {
      ...parsed.data,
      ...(parsed.data.secret ? { secret: encryptExternalSecret(parsed.data.secret) } : {}),
    }

    const updated = await db.externalScreeningAdapter.update({
      where: { id },
      data: updateData,
      select: SAFE_SELECT,
    })

    logger.info('External screening adapter updated', { adapterId: id, userId: session.user.id })

    return NextResponse.json(updated)
  } catch (err) {
    logger.error('Failed to update screening adapter', { error: err, id })
    return NextResponse.json({ error: 'Failed to update adapter' }, { status: 500 })
  }
}

/**
 * DELETE /api/screening-adapters/[id]
 * Remove a registered adapter and all its run history.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, 'RESEARCHER', 'CLINICIAN', 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const existing = await db.externalScreeningAdapter.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await db.externalScreeningAdapter.delete({ where: { id } })

    logger.info('External screening adapter deleted', { adapterId: id, userId: session.user.id })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    logger.error('Failed to delete screening adapter', { error: err, id })
    return NextResponse.json({ error: 'Failed to delete adapter' }, { status: 500 })
  }
}
