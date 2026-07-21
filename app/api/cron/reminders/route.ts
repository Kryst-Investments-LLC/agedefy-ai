/**
 * Cron: reminder delivery sweep.
 *
 * GET /api/cron/reminders — fans out due reminders over email + in-app.
 * Secured via CRON_SECRET bearer token (fail-closed when not configured).
 *
 * @module app/api/cron/reminders/route
 */

import { NextResponse, type NextRequest } from 'next/server'

import { sweepDueReminders } from '@/lib/reminders/reminder-sweeper'
import { logger } from '@/lib/logger'
import { requireCronAuthorization } from '@/lib/security/cron-auth'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  const unauthorized = requireCronAuthorization(request)
  if (unauthorized) return unauthorized

  try {
    const result = await sweepDueReminders()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    logger.error('Reminder cron sweep failed', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
  }
}
