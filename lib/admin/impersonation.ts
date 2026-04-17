/**
 * Support-Safe Admin Impersonation
 *
 * Allows admins to view a user's account in read-only mode for support
 * purposes without taking destructive actions. Every impersonation
 * start and stop is immutably logged to the audit trail.
 *
 * Constraints:
 * - Only ADMIN role users can impersonate
 * - Cannot impersonate other admins
 * - Read-only: no mutations allowed during impersonation
 * - Time-limited: sessions expire after 30 minutes
 * - Fully audited: start, stop, and every access logged
 * - Persistent: backed by AdminImpersonationSession table so guarantees
 *   hold across multiple app instances and restarts.
 *
 * @module lib/admin/impersonation
 */

import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const IMPERSONATION_TTL_MS = 30 * 60 * 1000 // 30 minutes

export interface ImpersonationSession {
  adminUserId: string
  targetUserId: string
  startedAt: Date
  expiresAt: Date
  reason: string
}

function toSession(row: {
  adminUserId: string
  targetUserId: string
  startedAt: Date
  expiresAt: Date
  reason: string
}): ImpersonationSession {
  return {
    adminUserId: row.adminUserId,
    targetUserId: row.targetUserId,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    reason: row.reason,
  }
}

/**
 * Start an impersonation session. Creates an immutable audit log entry.
 */
export async function startImpersonation(input: {
  adminUserId: string
  adminEmail: string
  targetUserId: string
  reason: string
}): Promise<{ success: true; session: ImpersonationSession } | { success: false; error: string }> {
  const admin = await db.user.findUnique({
    where: { id: input.adminUserId },
    select: { id: true, role: true },
  })
  if (!admin || admin.role !== 'ADMIN') {
    return { success: false, error: 'Only admins can impersonate users' }
  }

  const target = await db.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, role: true, email: true },
  })
  if (!target) {
    return { success: false, error: 'Target user not found' }
  }
  if (target.role === 'ADMIN') {
    return { success: false, error: 'Cannot impersonate admin users' }
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + IMPERSONATION_TTL_MS)

  const existing = await db.adminImpersonationSession.findUnique({
    where: { adminUserId: input.adminUserId },
  })
  if (existing && existing.stoppedAt === null && existing.expiresAt > now) {
    return {
      success: false,
      error: 'Admin already has an active impersonation session. Stop it first.',
    }
  }

  const row = await db.adminImpersonationSession.upsert({
    where: { adminUserId: input.adminUserId },
    create: {
      adminUserId: input.adminUserId,
      targetUserId: input.targetUserId,
      reason: input.reason,
      startedAt: now,
      expiresAt,
      stoppedAt: null,
    },
    update: {
      targetUserId: input.targetUserId,
      reason: input.reason,
      startedAt: now,
      expiresAt,
      stoppedAt: null,
    },
  })

  await logAudit({
    actorUserId: input.adminUserId,
    actorEmail: input.adminEmail,
    action: 'impersonation.start',
    entityType: 'user',
    entityId: input.targetUserId,
    details: {
      targetEmail: target.email,
      reason: input.reason,
      expiresAt: row.expiresAt.toISOString(),
    },
  })

  return { success: true, session: toSession(row) }
}

/**
 * Stop an active impersonation session.
 */
export async function stopImpersonation(adminUserId: string, adminEmail: string): Promise<boolean> {
  const session = await db.adminImpersonationSession.findUnique({
    where: { adminUserId },
  })
  if (!session || session.stoppedAt !== null) return false

  const stoppedAt = new Date()
  await db.adminImpersonationSession.update({
    where: { adminUserId },
    data: { stoppedAt },
  })

  await logAudit({
    actorUserId: adminUserId,
    actorEmail: adminEmail,
    action: 'impersonation.stop',
    entityType: 'user',
    entityId: session.targetUserId,
    details: {
      reason: session.reason,
      duration: stoppedAt.getTime() - session.startedAt.getTime(),
    },
  })

  return true
}

/**
 * Get the active impersonation session for an admin, if any.
 * Returns null if expired, stopped, or none exists.
 */
export async function getActiveImpersonation(
  adminUserId: string,
): Promise<ImpersonationSession | null> {
  const row = await db.adminImpersonationSession.findUnique({
    where: { adminUserId },
  })
  if (!row || row.stoppedAt !== null) return null
  if (row.expiresAt <= new Date()) return null
  return toSession(row)
}

/**
 * Check whether a request is in an impersonation context.
 * If so, mutations should be blocked (read-only mode).
 */
export async function isImpersonating(adminUserId: string): Promise<boolean> {
  return (await getActiveImpersonation(adminUserId)) !== null
}

/**
 * Guard for mutation routes. Returns a 403 NextResponse if the caller
 * is in an active impersonation session, or null if writes are allowed.
 *
 * Usage in any mutation route handler:
 *   const blocked = await blockWriteDuringImpersonation(session.user.id)
 *   if (blocked) return blocked
 */
export async function blockWriteDuringImpersonation(userId: string): Promise<Response | null> {
  if (!(await isImpersonating(userId))) return null

  return Response.json(
    {
      error:
        'Write operations are blocked during impersonation. Stop the impersonation session first.',
    },
    { status: 403 },
  )
}
