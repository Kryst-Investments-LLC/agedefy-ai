import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { blockWriteDuringImpersonation } from '@/lib/admin/impersonation'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { requireAuthWithRole } from '@/lib/rbac'
import { requireRecentMfa } from '@/lib/security/recent-mfa'

/**
 * GET /api/admin/sessions
 * List active sessions for a specific user (admin only).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, 'ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId query param required' }, { status: 400 })
  }

  const sessions = await db.activeSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastActiveAt: 'desc' },
    take: 200,
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastActiveAt: true,
    },
  })

  return NextResponse.json({ sessions })
}

/**
 * DELETE /api/admin/sessions
 * Revoke all sessions for a user (admin only).
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const authResult = requireAuthWithRole(session, 'ADMIN')
  if (authResult instanceof NextResponse) return authResult
  const mfaRequired = await requireRecentMfa(authResult.user.id)
  if (mfaRequired) return mfaRequired

  const impersonationBlock = await blockWriteDuringImpersonation(authResult.user.id)
  if (impersonationBlock) return impersonationBlock

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId query param required' }, { status: 400 })
  }

  const result = await db.activeSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  await logAudit({
    actorUserId: authResult.user.id,
    action: 'admin.sessions_revoked',
    entityType: 'User',
    entityId: userId,
    details: { count: result.count },
  })

  return NextResponse.json({ revoked: result.count })
}

