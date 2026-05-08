import crypto from 'crypto'
import { db } from '@/lib/db'

const MAX_ACTIVE_SESSIONS = parseInt(process.env.MAX_ACTIVE_SESSIONS || '5', 10)

/**
 * Hash a JWT ID (jti) for storage. We never store raw JTI values.
 */
export function hashJti(jti: string): string {
  return crypto.createHash('sha256').update(jti).digest('hex')
}

/**
 * Generate a random JTI for a new session.
 */
export function generateJti(): string {
  return crypto.randomUUID()
}

/**
 * Register a new active session. Enforces the concurrent session limit
 * by revoking the oldest sessions when the limit is exceeded.
 */
export async function registerSession(input: {
  userId: string
  jti: string
  userAgent?: string
  ipAddress?: string
}): Promise<void> {
  const tokenHash = hashJti(input.jti)

  await db.activeSession.create({
    data: {
      userId: input.userId,
      tokenHash,
      userAgent: input.userAgent?.slice(0, 512),
      ipAddress: input.ipAddress?.slice(0, 45),
    },
  })

  // Enforce concurrent session limit — revoke oldest sessions
  const activeSessions = await db.activeSession.findMany({
    where: { userId: input.userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (activeSessions.length > MAX_ACTIVE_SESSIONS) {
    const toRevoke = activeSessions.slice(MAX_ACTIVE_SESSIONS)
    await db.activeSession.updateMany({
      where: { id: { in: toRevoke.map((s) => s.id) } },
      data: { revokedAt: new Date() },
    })
  }
}

/**
 * Check whether a session is still valid (not revoked).
 */
export async function isSessionValid(jti: string): Promise<boolean> {
  const tokenHash = hashJti(jti)
  const session = await db.activeSession.findUnique({ where: { tokenHash } })
  return !!session && !session.revokedAt
}

/**
 * Update lastActiveAt for a session (called on JWT refresh).
 */
export async function touchSession(jti: string): Promise<void> {
  const tokenHash = hashJti(jti)
  await db.activeSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { lastActiveAt: new Date() },
  })
}

/**
 * Revoke a specific session by its DB id.
 */
export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  const session = await db.activeSession.findUnique({ where: { id: sessionId } })
  if (!session || session.userId !== userId) return false
  await db.activeSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  })
  return true
}

/**
 * Revoke all active sessions for a user.
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await db.activeSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count
}

/**
 * List active sessions for a user.
 */
export async function listActiveSessions(userId: string) {
  return db.activeSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastActiveAt: 'desc' },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastActiveAt: true,
    },
  })
}
