import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import {
  startImpersonation,
  stopImpersonation,
  getActiveImpersonation,
} from '@/lib/admin/impersonation'
import { requireAuthWithRole } from '@/lib/rbac'

/**
 * GET /api/admin/impersonate
 * Get the current active impersonation session for the calling admin.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const impersonation = await getActiveImpersonation(authResult.user.id)
  if (!impersonation) {
    return NextResponse.json({ active: false })
  }

  return NextResponse.json({
    active: true,
    targetUserId: impersonation.targetUserId,
    startedAt: impersonation.startedAt.toISOString(),
    expiresAt: impersonation.expiresAt.toISOString(),
    reason: impersonation.reason,
  })
}

/**
 * POST /api/admin/impersonate
 * Start an impersonation session. Body: { targetUserId, reason }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json()
  const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId.trim() : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  if (!targetUserId) {
    return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
  }
  if (!reason || reason.length < 5) {
    return NextResponse.json({ error: 'A reason (min 5 chars) is required for impersonation' }, { status: 400 })
  }

  const result = await startImpersonation({
    adminUserId: authResult.user.id,
    adminEmail: authResult.user.email ?? '',
    targetUserId,
    reason,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    active: true,
    targetUserId: result.session.targetUserId,
    startedAt: result.session.startedAt.toISOString(),
    expiresAt: result.session.expiresAt.toISOString(),
  })
}

/**
 * DELETE /api/admin/impersonate
 * Stop the current impersonation session.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const stopped = await stopImpersonation(authResult.user.id, authResult.user.email ?? '')
  if (!stopped) {
    return NextResponse.json({ error: 'No active impersonation session' }, { status: 404 })
  }

  return NextResponse.json({ active: false })
}

