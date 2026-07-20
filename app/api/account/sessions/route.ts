import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { listActiveSessions, revokeAllSessions, revokeSession } from '@/lib/session-governance'
import { requireRecentMfa } from '@/lib/security/recent-mfa'

/**
 * GET /api/account/sessions
 * List current user's active sessions.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessions = await listActiveSessions(session.user.id)
  return NextResponse.json({ sessions })
}

/**
 * DELETE /api/account/sessions
 * Revoke a specific session (by `sessionId` query param) or all sessions.
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const mfaRequired = await requireRecentMfa(session.user.id)
  if (mfaRequired) return mfaRequired

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (sessionId) {
    const revoked = await revokeSession(sessionId, session.user.id)
    if (!revoked) {
      return NextResponse.json({ error: 'Session not found or not owned by user' }, { status: 404 })
    }
    return NextResponse.json({ revoked: true })
  }

  const count = await revokeAllSessions(session.user.id)
  return NextResponse.json({ revokedAll: true, count })
}
