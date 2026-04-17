import { createReviewItem } from '@/lib/audit'
import { rateLimitAbuseCounter } from '@/lib/observability/telemetry'

/**
 * In-memory tracker for rate-limit blocks per key.
 * When a key exceeds the abuse threshold within a rolling window,
 * an OTel metric is emitted and a ReviewItem is created for manual review.
 */

const ABUSE_WINDOW_MS = 5 * 60_000 // 5 minutes
const ABUSE_THRESHOLD = 10 // 10 blocks in the window → flag as abuse
const REVIEW_COOLDOWN_MS = 30 * 60_000 // only create one ReviewItem per key per 30 min

interface BlockRecord {
  timestamps: number[]
  lastReviewAt: number
}

const tracker = new Map<string, BlockRecord>()

// Periodic cleanup of stale keys
setInterval(() => {
  const cutoff = Date.now() - ABUSE_WINDOW_MS
  for (const [key, record] of tracker) {
    record.timestamps = record.timestamps.filter((t) => t > cutoff)
    if (record.timestamps.length === 0 && Date.now() - record.lastReviewAt > REVIEW_COOLDOWN_MS) {
      tracker.delete(key)
    }
  }
}, 60_000).unref?.()

/**
 * Record a rate-limit block and check for abuse patterns.
 * Called as a side effect from `applyRateLimit` when a request is blocked.
 */
export async function recordRateLimitBlock(ip: string, route: string): Promise<void> {
  const key = `${ip}:${route}`
  const now = Date.now()
  const cutoff = now - ABUSE_WINDOW_MS

  let record = tracker.get(key)
  if (!record) {
    record = { timestamps: [], lastReviewAt: 0 }
    tracker.set(key, record)
  }

  record.timestamps = record.timestamps.filter((t) => t > cutoff)
  record.timestamps.push(now)

  if (record.timestamps.length >= ABUSE_THRESHOLD) {
    rateLimitAbuseCounter.add(1, { ip, route })

    if (now - record.lastReviewAt > REVIEW_COOLDOWN_MS) {
      record.lastReviewAt = now
      await createReviewItem({
        title: `Rate limit abuse detected: ${ip} on ${route}`,
        category: 'rate_limit_abuse',
        severity: 'HIGH',
        details: JSON.stringify({
          ip,
          route,
          blockCount: record.timestamps.length,
          windowMinutes: ABUSE_WINDOW_MS / 60_000,
        }),
      }).catch(() => {
        // Best-effort — don't break the request path if DB write fails
      })
    }
  }
}

/** Reset tracker state (for tests). */
export function resetRateLimitMonitor(): void {
  tracker.clear()
}
