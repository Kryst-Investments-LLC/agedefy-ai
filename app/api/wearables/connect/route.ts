import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { applyRateLimit } from '@/lib/rate-limit'
import { createWidgetSession, deauthUser } from '@/lib/wearables/terra-client'
import { requireRecentMfa } from '@/lib/security/recent-mfa'

/**
 * POST /api/wearables/connect
 *
 * Generate a Terra widget session for the user to connect a wearable device.
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const widgetSession = await createWidgetSession(session.user.id)
  if (!widgetSession) {
    return NextResponse.json(
      { error: 'Wearable integration is not configured' },
      { status: 503 },
    )
  }

  return NextResponse.json({
    widgetUrl: widgetSession.url,
    sessionId: widgetSession.sessionId,
  })
}

/**
 * GET /api/wearables/connect
 *
 * List the user's wearable connections.
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connections = await db.wearableConnection.findMany({
    where: { userId: session.user.id },
    orderBy: { connectedAt: 'desc' },
    select: {
      id: true,
      provider: true,
      status: true,
      connectedAt: true,
      lastSyncAt: true,
    },
  })

  return NextResponse.json({ connections })
}

/**
 * DELETE /api/wearables/connect
 *
 * Disconnect a wearable provider.
 * Body: { provider: string }
 */
export async function DELETE(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 5, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const mfaRequired = await requireRecentMfa(session.user.id)
  if (mfaRequired) return mfaRequired

  let body: { provider?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.provider) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 })
  }

  const connection = await db.wearableConnection.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: body.provider } },
  })

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // Deauth from Terra if we have an external user ID
  if (connection.externalUserId) {
    await deauthUser(connection.externalUserId)
  }

  await db.wearableConnection.update({
    where: { id: connection.id },
    data: { status: 'disconnected' },
  })

  return NextResponse.json({ ok: true })
}
