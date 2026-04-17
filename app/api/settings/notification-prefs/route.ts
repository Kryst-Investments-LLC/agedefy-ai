import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// ─── Validation ─────────────────────────────────────────────

const VALID_HOURS = Array.from({ length: 24 }, (_, i) => i) // 0-23

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// ─── GET ────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await db.userProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      driftNotificationsOn: true,
    },
  })

  return NextResponse.json({
    timezone: profile?.timezone ?? null,
    quietHoursStart: profile?.quietHoursStart ?? 22,
    quietHoursEnd: profile?.quietHoursEnd ?? 7,
    driftNotificationsOn: profile?.driftNotificationsOn ?? true,
  })
}

// ─── PATCH ──────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  // Timezone
  if ('timezone' in body) {
    if (body.timezone === null) {
      updates.timezone = null
    } else if (typeof body.timezone === 'string' && isValidTimezone(body.timezone)) {
      updates.timezone = body.timezone
    } else {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
    }
  }

  // Quiet hours start
  if ('quietHoursStart' in body) {
    const v = body.quietHoursStart
    if (typeof v === 'number' && VALID_HOURS.includes(v)) {
      updates.quietHoursStart = v
    } else {
      return NextResponse.json({ error: 'quietHoursStart must be 0-23' }, { status: 400 })
    }
  }

  // Quiet hours end
  if ('quietHoursEnd' in body) {
    const v = body.quietHoursEnd
    if (typeof v === 'number' && VALID_HOURS.includes(v)) {
      updates.quietHoursEnd = v
    } else {
      return NextResponse.json({ error: 'quietHoursEnd must be 0-23' }, { status: 400 })
    }
  }

  // Master toggle
  if ('driftNotificationsOn' in body) {
    if (typeof body.driftNotificationsOn === 'boolean') {
      updates.driftNotificationsOn = body.driftNotificationsOn
    } else {
      return NextResponse.json({ error: 'driftNotificationsOn must be boolean' }, { status: 400 })
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const profile = await db.userProfile.upsert({
    where: { userId: session.user.id },
    update: updates,
    create: {
      userId: session.user.id,
      ...updates,
    },
    select: {
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      driftNotificationsOn: true,
    },
  })

  return NextResponse.json(profile)
}
