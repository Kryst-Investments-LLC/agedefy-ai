/**
 * Reminder delivery sweep.
 *
 * Finds PENDING reminders that are due and not yet notified, fans them out over
 * the notifications integration (email + in-app), and stamps `notifiedAt` so
 * each fires exactly once. Idempotent and safe to run on a cron. Never throws
 * per-reminder — one bad recipient can't stall the batch.
 */

import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { notificationsIntegration } from '@/scientist-sponsor-marketplace/backend/integrations/notificationsIntegration'

export interface ReminderSweepResult {
  due: number
  notified: number
  failed: number
}

export async function sweepDueReminders(now: Date = new Date(), batchSize = 200): Promise<ReminderSweepResult> {
  const dueReminders = await db.reminder.findMany({
    where: { status: 'PENDING', notifiedAt: null, dueAt: { lte: now } },
    orderBy: { dueAt: 'asc' },
    take: batchSize,
    select: {
      id: true,
      tenantId: true,
      kind: true,
      title: true,
      detail: true,
      user: { select: { id: true, email: true, name: true } },
    },
  })

  const appUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? ''
  let notified = 0
  let failed = 0

  for (const r of dueReminders) {
    try {
      const deliveries = await notificationsIntegration.dispatch(
        ['in_app', 'email'],
        r.title,
        r.detail ?? 'It is time to re-measure your biomarkers.',
        {
          recipientEmail: r.user.email,
          recipientName: r.user.name,
          actionUrl: `${appUrl}/lab-testing`,
          metadata: { reminderId: r.id, kind: r.kind, tenantId: r.tenantId },
        },
      )

      // Stamp notifiedAt only if still pending & unnotified (guards against a
      // concurrent sweep double-sending).
      const updated = await db.reminder.updateMany({
        where: { id: r.id, status: 'PENDING', notifiedAt: null },
        data: { notifiedAt: new Date() },
      })
      if (updated.count === 0) continue // another worker got it first

      notified++
      await logAudit({
        actorUserId: r.user.id,
        tenantId: r.tenantId,
        action: 'reminder.notified',
        entityType: 'Reminder',
        entityId: r.id,
        details: { kind: r.kind, deliveries },
      })
    } catch (err) {
      failed++
      logger.error('Reminder delivery failed', { reminderId: r.id, error: String(err) })
    }
  }

  logger.info('Reminder sweep complete', { due: dueReminders.length, notified, failed })
  return { due: dueReminders.length, notified, failed }
}
