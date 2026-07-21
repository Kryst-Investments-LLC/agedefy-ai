/**
 * Reminders API — schedule and manage user-facing reminders (e.g. re-measure
 * your biomarker panel to close the measurement loop).
 *
 *   GET   /api/reminders            → pending reminders for the user
 *   POST  /api/reminders            → create (idempotent per kind while PENDING)
 *   PATCH /api/reminders            → { id, status: DONE | DISMISSED }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const KINDS = new Set(['REMEASURE'])

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reminders = await db.reminder.findMany({
    where: { userId: session.user.id, status: 'PENDING' },
    orderBy: { dueAt: 'asc' },
    select: { id: true, kind: true, title: true, detail: true, dueAt: true, status: true, notifiedAt: true },
  })
  return NextResponse.json({ reminders })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    kind?: string
    title?: string
    detail?: string
    dueInDays?: number
  }
  const kind = body.kind ?? 'REMEASURE'
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'Unknown reminder kind' }, { status: 400 })

  // Idempotent: reuse an existing pending reminder of the same kind.
  const existing = await db.reminder.findFirst({
    where: { userId: session.user.id, kind, status: 'PENDING' },
    select: { id: true, kind: true, title: true, detail: true, dueAt: true, status: true },
  })
  if (existing) return NextResponse.json({ reminder: existing, created: false })

  const days = Number.isFinite(body.dueInDays) ? Math.min(365, Math.max(1, Number(body.dueInDays))) : 90
  const dueAt = new Date(Date.now() + days * 24 * 3600 * 1000)
  const tenantId = (session.user as { tenantId?: string }).tenantId ?? 'default'

  const reminder = await db.reminder.create({
    data: {
      userId: session.user.id,
      tenantId,
      kind,
      title: body.title ?? 'Re-test your biomarker panel',
      detail: body.detail ?? 'Re-measure to capture the effect of your current protocol on your markers.',
      dueAt,
    },
    select: { id: true, kind: true, title: true, detail: true, dueAt: true, status: true },
  })

  await logAudit({
    actorUserId: session.user.id,
    tenantId,
    action: 'reminder.scheduled',
    entityType: 'Reminder',
    entityId: reminder.id,
    details: { kind, dueAt: dueAt.toISOString() },
  })

  return NextResponse.json({ reminder, created: true }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = (await request.json().catch(() => ({}))) as { id?: string; status?: string }
  if (!id || (status !== 'DONE' && status !== 'DISMISSED')) {
    return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 })
  }

  // Scope the update to the caller so one user can't touch another's reminders.
  const result = await db.reminder.updateMany({
    where: { id, userId: session.user.id },
    data: { status },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
