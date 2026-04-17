import { logAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

import { detectDrift } from './drift-detector'
import type { DriftFinding } from './drift-detector'
import { SupervisorAgent } from './supervisor'

export type SweepBatchResult = {
  usersScanned: number
  driftsDetected: number
  sessionsTriggered: number
  errors: number
}

const PROACTIVE_SESSION_THRESHOLD: DriftFinding['severity'][] = ['high', 'critical']

// ─── Notification Fatigue Prevention ───────────────────────

/** Fallback quiet-hours when user has no profile preferences */
const DEFAULT_QUIET_START = 22 // 10 PM
const DEFAULT_QUIET_END = 7   //  7 AM

/**
 * Minimum interval between notifications for the *same biomarker* to the
 * same user. Prevents a single flapping metric from spamming alerts.
 */
const PER_BIOMARKER_COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Minimum interval between *any* drift notification to a single user.
 * Even if multiple different biomarkers drift, the user only gets one
 * bundled alert per cooldown window.
 */
const GLOBAL_USER_COOLDOWN_MS = 4 * 60 * 60 * 1000 // 4 hours

type UserQuietPrefs = {
  timezone: string | null
  quietHoursStart: number
  quietHoursEnd: number
  driftNotificationsOn: boolean
}

/**
 * Loads the user's notification preferences from their profile.
 * Returns sensible defaults if no preferences are stored.
 */
async function loadUserQuietPrefs(userId: string): Promise<UserQuietPrefs> {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: {
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      driftNotificationsOn: true,
    },
  })

  return {
    timezone: profile?.timezone ?? null,
    quietHoursStart: profile?.quietHoursStart ?? DEFAULT_QUIET_START,
    quietHoursEnd: profile?.quietHoursEnd ?? DEFAULT_QUIET_END,
    driftNotificationsOn: profile?.driftNotificationsOn ?? true,
  }
}

/**
 * Checks whether the current time falls within the user's quiet-hours
 * window. If the user has a timezone set, the check uses their local
 * clock; otherwise falls back to UTC.
 */
function isQuietHours(
  prefs: UserQuietPrefs,
  now: Date = new Date(),
): boolean {
  let hour: number

  if (prefs.timezone) {
    // Derive the user's local hour from their IANA timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: prefs.timezone,
      hour: 'numeric',
      hour12: false,
    })
    hour = parseInt(formatter.format(now), 10)
  } else {
    hour = now.getUTCHours()
  }

  const start = prefs.quietHoursStart
  const end = prefs.quietHoursEnd

  // Handles wrap-around: e.g. 22..23, 0..6
  if (start > end) {
    return hour >= start || hour < end
  }
  return hour >= start && hour < end
}

/**
 * Checks whether we should suppress a notification for a user based on:
 * 0. Master toggle off (returns 'disabled')
 * 1. Quiet hours (returns 'quiet-hours')
 * 2. Global user cooldown (returns 'user-cooldown')
 * 3. Per-biomarker cooldown (filters findings, returns 'partial' or 'all-cooled')
 * Returns null if the notification should proceed with the full findings list.
 */
async function checkNotificationGating(
  userId: string,
  findings: DriftFinding[],
  prefs: UserQuietPrefs,
): Promise<{
  action: 'suppress' | 'proceed'
  reason?: 'disabled' | 'quiet-hours' | 'user-cooldown' | 'all-cooled'
  filteredFindings: DriftFinding[]
}> {
  // 0. Master toggle — user has turned off drift alerts entirely
  if (!prefs.driftNotificationsOn) {
    return { action: 'suppress', reason: 'disabled', filteredFindings: [] }
  }

  // 1. Quiet hours — suppress entirely, sweep record is still saved
  if (isQuietHours(prefs)) {
    return { action: 'suppress', reason: 'quiet-hours', filteredFindings: [] }
  }

  // 2. Global user cooldown — check most recent notification
  const latestNotification = await db.driftNotification.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, biomarkerNames: true },
  })

  if (latestNotification) {
    const elapsed = Date.now() - latestNotification.createdAt.getTime()
    if (elapsed < GLOBAL_USER_COOLDOWN_MS) {
      return { action: 'suppress', reason: 'user-cooldown', filteredFindings: [] }
    }
  }

  // 3. Per-biomarker cooldown — filter out biomarkers that were recently notified
  const cooldownThreshold = new Date(Date.now() - PER_BIOMARKER_COOLDOWN_MS)
  const recentNotifications = await db.driftNotification.findMany({
    where: {
      userId,
      createdAt: { gte: cooldownThreshold },
    },
    select: { biomarkerNames: true },
  })

  const recentlyNotifiedNames = new Set<string>()
  for (const n of recentNotifications) {
    try {
      const names = JSON.parse(n.biomarkerNames) as string[]
      for (const name of names) recentlyNotifiedNames.add(name)
    } catch { /* skip malformed */ }
  }

  const filteredFindings = findings.filter(
    (f) => !recentlyNotifiedNames.has(f.biomarkerName),
  )

  if (filteredFindings.length === 0) {
    return { action: 'suppress', reason: 'all-cooled', filteredFindings: [] }
  }

  return { action: 'proceed', filteredFindings }
}

/**
 * Builds a human-readable notification for a drift sweep that found issues.
 */
function buildNotification(findings: DriftFinding[]): { title: string; body: string } {
  const topFinding = findings[0]
  const count = findings.length

  if (count === 1) {
    return {
      title: `Shift detected in your ${topFinding.biomarkerName}`,
      body: `Biozephyra noticed ${topFinding.reason} The Discovery Lab has drafted a brief analysis for you to review.`,
    }
  }

  return {
    title: `Subtle shifts detected in ${count} biomarkers`,
    body: `Biozephyra noticed changes in ${findings.map((f) => f.biomarkerName).join(', ')} over the past ${topFinding.windowDays} days. The Discovery Lab has drafted a brief analysis for you to review.`,
  }
}

/**
 * Runs the drift sweep for a single user. Called by the batch runner.
 */
async function sweepUser(
  userId: string,
  tenantId: string,
  triggerType: 'scheduled' | 'manual',
): Promise<{ driftsDetected: number; sessionTriggered: boolean }> {
  const result = await detectDrift(userId)

  if (result.findings.length === 0) {
    // Persist a clean sweep record (no drift)
    await db.driftSweep.create({
      data: {
        userId,
        tenantId,
        biomarkersScanned: result.biomarkersScanned,
        driftsDetected: 0,
        findings: '[]',
        triggerType,
      },
    })
    return { driftsDetected: 0, sessionTriggered: false }
  }

  // ── Notification gating ────────────────────────────────
  // Always record the sweep data, but gate user-facing notifications
  // and proactive sessions to prevent alert fatigue.
  const quietPrefs = await loadUserQuietPrefs(userId)
  const gating = await checkNotificationGating(userId, result.findings, quietPrefs)

  // Persist sweep record regardless of gating
  const sweep = await db.driftSweep.create({
    data: {
      userId,
      tenantId,
      biomarkersScanned: result.biomarkersScanned,
      driftsDetected: result.findings.length,
      findings: JSON.stringify(result.findings),
      triggerType,
    },
  })

  if (gating.action === 'suppress') {
    logger.info('Drift notification suppressed', {
      userId,
      reason: gating.reason,
      driftsDetected: result.findings.length,
    })

    await logAudit({
      actorUserId: userId,
      tenantId,
      action: 'drift.sweep_completed',
      entityType: 'DriftSweep',
      entityId: sweep.id,
      details: {
        biomarkersScanned: result.biomarkersScanned,
        driftsDetected: result.findings.length,
        notificationSuppressed: true,
        suppressReason: gating.reason,
      },
    })

    return { driftsDetected: result.findings.length, sessionTriggered: false }
  }

  // Use filtered findings for notification (removes recently-alerted biomarkers)
  const notifiableFindings = gating.filteredFindings

  // Determine highest severity from notifiable findings
  const maxSeverity = notifiableFindings[0].severity
  const shouldTriggerSession = PROACTIVE_SESSION_THRESHOLD.includes(maxSeverity)

  let proactiveSessionId: string | undefined

  if (shouldTriggerSession) {
    try {
      const supervisor = new SupervisorAgent(userId, tenantId)
      const driftSummary = notifiableFindings
        .map((f) => f.reason)
        .join(' ')
      const agentResult = await supervisor.run(
        `[Proactive Drift Analysis] Biological drift detected: ${driftSummary}`,
      )
      proactiveSessionId = agentResult.sessionId
    } catch (err) {
      logger.error('Failed to spawn proactive session for drift', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Update sweep with session ID if one was triggered
  if (proactiveSessionId) {
    await db.driftSweep.update({
      where: { id: sweep.id },
      data: { proactiveSessionId },
    })
  }

  // Create user notification with filtered (non-cooled) findings
  const { title, body } = buildNotification(notifiableFindings)
  await db.driftNotification.create({
    data: {
      userId,
      tenantId,
      sweepId: sweep.id,
      title,
      body,
      severity: maxSeverity.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      biomarkerNames: JSON.stringify(notifiableFindings.map((f) => f.biomarkerName)),
      sessionId: proactiveSessionId,
    },
  })

  await logAudit({
    actorUserId: userId,
    tenantId,
    action: 'drift.sweep_completed',
    entityType: 'DriftSweep',
    entityId: sweep.id,
    details: {
      biomarkersScanned: result.biomarkersScanned,
      driftsDetected: result.findings.length,
      maxSeverity,
      sessionTriggered: shouldTriggerSession,
      proactiveSessionId,
    },
  })

  return {
    driftsDetected: result.findings.length,
    sessionTriggered: !!proactiveSessionId,
  }
}

/**
 * Runs the biological drift sweep across all eligible users.
 * Called by the cron endpoint. Processes users in batches to avoid
 * overwhelming the database.
 */
export async function runDriftSweepBatch(
  triggerType: 'scheduled' | 'manual' = 'scheduled',
): Promise<SweepBatchResult> {
  const BATCH_SIZE = 50

  // Find users with recent biomarker data (active users)
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 30) // users with data in last 30 days

  const eligibleUsers = await db.biomarker.findMany({
    where: { measuredAt: { gte: windowStart } },
    select: { userId: true, user: { select: { defaultTenantId: true } } },
    distinct: ['userId'],
  })

  const result: SweepBatchResult = {
    usersScanned: 0,
    driftsDetected: 0,
    sessionsTriggered: 0,
    errors: 0,
  }

  // Process in batches
  for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
    const batch = eligibleUsers.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.allSettled(
      batch.map((u) =>
        sweepUser(u.userId, u.user.defaultTenantId ?? 'default', triggerType),
      ),
    )

    for (const r of batchResults) {
      result.usersScanned++
      if (r.status === 'fulfilled') {
        result.driftsDetected += r.value.driftsDetected
        if (r.value.sessionTriggered) result.sessionsTriggered++
      } else {
        result.errors++
        logger.error('Drift sweep failed for user', { error: String(r.reason) })
      }
    }
  }

  logger.info('Drift sweep batch completed', result)

  return result
}
