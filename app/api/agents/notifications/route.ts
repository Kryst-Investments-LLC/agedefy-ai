import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { safeJsonParse } from '@/lib/safe-json'

/**
 * GET /api/agents/notifications
 *
 * Returns the authenticated user's drift notifications, newest first.
 * Query params:
 *   - unread=true  → only unread notifications
 *   - limit=N      → max results (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'
  const limitParam = parseInt(url.searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(Math.max(1, limitParam), 100)

  const where: Record<string, unknown> = { userId: session.user.id }
  if (unreadOnly) {
    where.readAt = null
    where.dismissedAt = null
  }

  const [notifications, unreadCount] = await Promise.all([
    db.driftNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.driftNotification.count({
      where: { userId: session.user.id, readAt: null, dismissedAt: null },
    }),
  ])

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      severity: n.severity,
      biomarkerNames: (n.biomarkerNames as string[]) ?? [],
      sessionId: n.sessionId,
      readAt: n.readAt,
      dismissedAt: n.dismissedAt,
      createdAt: n.createdAt,
    })),
    unreadCount,
  })
}

/**
 * PATCH /api/agents/notifications
 *
 * Mark notifications as read or dismissed.
 * Body: { ids: string[], action: 'read' | 'dismiss' }
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { ids?: string[]; action?: string }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  if (body.ids.length > 100) {
    return NextResponse.json({ error: 'Too many ids (max 100)' }, { status: 400 })
  }

  if (body.action !== 'read' && body.action !== 'dismiss') {
    return NextResponse.json({ error: 'action must be "read" or "dismiss"' }, { status: 400 })
  }

  const now = new Date()
  const data = body.action === 'read' ? { readAt: now } : { dismissedAt: now }

  await db.driftNotification.updateMany({
    where: {
      id: { in: body.ids },
      userId: session.user.id, // ownership check
    },
    data,
  })

  return NextResponse.json({ ok: true })
}
