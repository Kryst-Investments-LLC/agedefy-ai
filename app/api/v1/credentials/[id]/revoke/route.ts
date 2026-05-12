/**
 * POST /api/v1/credentials/[id]/revoke
 *
 * Revokes a previously issued Verifiable Credential by its `id` (typically a
 * urn:uuid:* string emitted at issue time). Calls the vc-signer sidecar's
 * /v1/revoke endpoint and writes an audit-log entry.
 *
 * Auth: requires an authenticated user with the ADMIN role OR an email listed
 * in ADMIN_EMAILS. Self-service revocation by the credential subject is not
 * yet supported because we don't store an issued-VC -> userId mapping.
 *
 * Body: { reason?: string }
 *
 * T2 — VC revocation surface.
 */

import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { isAdminRole, isConfiguredAdminEmail } from '@/lib/admin'
import { applyRateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { vcSigner, SidecarError } from '@/lib/sidecars'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })
  const allowed = isAdminRole(dbUser?.role) || isConfiguredAdminEmail(dbUser?.email ?? session.user.email)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!id || typeof id !== 'string' || id.length > 512) {
    return NextResponse.json({ error: 'Invalid credential id' }, { status: 400 })
  }

  let reason: string | undefined
  try {
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown }
    if (typeof body.reason === 'string') reason = body.reason.slice(0, 500)
  } catch {
    // tolerate empty body
  }

  const traceparent = request.headers.get('traceparent') ?? undefined

  try {
    const result = await vcSigner.revoke(id, traceparent)
    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      action: 'vc.revoke',
      entityType: 'VerifiableCredential',
      entityId: id,
      details: { reason: reason ?? null, sidecarStatus: result.status },
    })
    return NextResponse.json({
      id: result.id,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
    })
  } catch (err) {
    if (err instanceof SidecarError) {
      logger.warn('vc-signer revoke failed', { id, status: err.status, msg: err.message })
      return NextResponse.json({ error: 'Revocation failed' }, { status: 502 })
    }
    logger.error('vc-signer revoke unexpected error', { id, err: (err as Error).message })
    return NextResponse.json({ error: 'Revocation failed' }, { status: 500 })
  }
}
