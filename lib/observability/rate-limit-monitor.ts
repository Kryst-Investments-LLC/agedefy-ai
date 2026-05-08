import { rateLimitAbuseCounter, rateLimitBlockedCounter } from '@/lib/observability/telemetry'

export interface RateLimitEvent {
  ip: string
  route: string
  tenantId: string
  timestamp: number
}

const ABUSE_WINDOW_MS = 5 * 60 * 1000  // 5 minutes
const ABUSE_THRESHOLD = 50             // blocks within window to flag abuse

const recentBlocks = new Map<string, number[]>()

let cleanupTimer: ReturnType<typeof setInterval> | undefined

function ensureCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, timestamps] of recentBlocks) {
      const recent = timestamps.filter((t) => now - t < ABUSE_WINDOW_MS)
      if (recent.length === 0) {
        recentBlocks.delete(key)
      } else {
        recentBlocks.set(key, recent)
      }
    }
    if (recentBlocks.size === 0) {
      clearInterval(cleanupTimer)
      cleanupTimer = undefined
    }
  }, 60_000)
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref()
  }
}

export function recordRateLimitBlock(event: RateLimitEvent): { isAbuse: boolean; blockCount: number } {
  const key = `${event.ip}:${event.route}`
  const now = Date.now()

  const existing = recentBlocks.get(key) ?? []
  existing.push(now)
  const recent = existing.filter((t) => now - t < ABUSE_WINDOW_MS)
  recentBlocks.set(key, recent)

  rateLimitBlockedCounter.add(1, { route: event.route, tenant: event.tenantId })

  const isAbuse = recent.length >= ABUSE_THRESHOLD
  if (isAbuse) {
    rateLimitAbuseCounter.add(1, { ip: event.ip, route: event.route, tenant: event.tenantId })
  }

  ensureCleanup()

  return { isAbuse, blockCount: recent.length }
}

export function getRateLimitStats(): { trackedKeys: number; totalBlocks: number } {
  let totalBlocks = 0
  for (const timestamps of recentBlocks.values()) {
    totalBlocks += timestamps.length
  }
  return { trackedKeys: recentBlocks.size, totalBlocks }
}
