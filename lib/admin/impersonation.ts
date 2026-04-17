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

// In-memory store of active impersonation sessions.
// In production with multiple instances, this would be backed by Redis.
const activeSessions = new Map<string, ImpersonationSession>()

/**
 * Start an impersonation session. Creates an immutable audit log entry.
 */
export async function startImpersonation(input: {
  adminUserId: string
  adminEmail: string
  targetUserId: string
  reason: string
}): Promise<{ success: true; session: ImpersonationSession } | { success: false; error: string }> {
  // Verify admin exists
  const admin = await db.user.findUnique({
    where: { id: input.adminUserId },
    select: { id: true, role: true },
  })
  if (!admin || admin.role !== 'ADMIN') {
    return { success: false, error: 'Only admins can impersonate users' }
  }

  // Verify target exists and is not an admin
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

  // Check for existing active session for this admin
  const existingKey = `${input.adminUserId}`
  const existing = activeSessions.get(existingKey)
  if (existing && existing.expiresAt > new Date()) {
    return { success: false, error: 'Admin already has an active impersonation session. Stop it first.' }
  }

  const now = new Date()
  const session: ImpersonationSession = {
    adminUserId: input.adminUserId,
    targetUserId: input.targetUserId,
    startedAt: now,
    expiresAt: new Date(now.getTime() + IMPERSONATION_TTL_MS),
    reason: input.reason,
  }

  activeSessions.set(existingKey, session)

  // Immutable audit log
  await logAudit({
    actorUserId: input.adminUserId,
    actorEmail: input.adminEmail,
    action: 'impersonation.start',
    entityType: 'user',
    entityId: input.targetUserId,
    details: {
      targetEmail: target.email,
      reason: input.reason,
      expiresAt: session.expiresAt.toISOString(),
    },
  })

  return { success: true, session }
}

/**
 * Stop an active impersonation session.
 */
export async function stopImpersonation(adminUserId: string, adminEmail: string): Promise<boolean> {
  const key = `${adminUserId}`
  const session = activeSessions.get(key)
  if (!session) return false

  activeSessions.delete(key)

  await logAudit({
    actorUserId: adminUserId,
    actorEmail: adminEmail,
    action: 'impersonation.stop',
    entityType: 'user',
    entityId: session.targetUserId,
    details: {
      reason: session.reason,
      duration: Date.now() - session.startedAt.getTime(),
    },
  })

  return true
}

/**
 * Get the active impersonation session for an admin, if any.
 * Returns null if expired or none exists.
 */
export function getActiveImpersonation(adminUserId: string): ImpersonationSession | null {
  const session = activeSessions.get(adminUserId)
  if (!session) return null
  if (session.expiresAt <= new Date()) {
    activeSessions.delete(adminUserId)
    return null
  }
  return session
}

/**
 * Check whether a request is in an impersonation context.
 * If so, mutations should be blocked (read-only mode).
 */
export function isImpersonating(adminUserId: string): boolean {
  return getActiveImpersonation(adminUserId) !== null
}

/**
 * Guard for mutation routes. Returns a 403 NextResponse if the caller
 * is in an active impersonation session, or null if writes are allowed.
 *
 * Usage in any mutation route handler:
 *   const blocked = blockWriteDuringImpersonation(session.user.id)
 *   if (blocked) return blocked
 */
export function blockWriteDuringImpersonation(userId: string): Response | null {
  if (!isImpersonating(userId)) return null

  return Response.json(
    { error: 'Write operations are blocked during impersonation. Stop the impersonation session first.' },
    { status: 403 },
  )
}
