import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"

import { env, getRuntimeBaseline } from "@/lib/env"
import { rateLimitBlockedCounter } from "@/lib/observability/telemetry"
import { recordRateLimitBlock } from "@/lib/rate-limit-monitor"

/**
 * Rate limiter for API routes with an in-memory fallback outside enforced staging/production baselines.
 */
const windowMs = 60_000 // 1 minute window
const maxRequests = 60  // max per window per key

export interface RateLimitOptions {
  maxRequests?: number
  windowMs?: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
  limit: number
  store: string
}

interface BucketEntry {
  count: number
  resetAt: number
}

interface RateLimitStore {
  kind: string
  increment(key: string, opts?: RateLimitOptions): Promise<RateLimitResult>
}

class InMemoryRateLimitStore implements RateLimitStore {
  readonly kind = "memory"

  private readonly buckets = new Map<string, BucketEntry>()

  constructor() {
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.buckets) {
        if (entry.resetAt <= now) this.buckets.delete(key)
      }
    }, 60_000).unref?.()
  }

  incrementSync(key: string, opts?: RateLimitOptions): RateLimitResult {
    const limit = opts?.maxRequests ?? maxRequests
    const window = opts?.windowMs ?? windowMs
    const now = Date.now()

    let entry = this.buckets.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + window }
      this.buckets.set(key, entry)
    }

    entry.count++

    return {
      success: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
      limit,
      store: this.kind,
    }
  }

  async increment(key: string, opts?: RateLimitOptions): Promise<RateLimitResult> {
    return this.incrementSync(key, opts)
  }
}

class UpstashRedisRateLimitStore implements RateLimitStore {
  readonly kind = "redis"

  constructor(private readonly redis: Redis) {}

  async increment(key: string, opts?: RateLimitOptions): Promise<RateLimitResult> {
    const limit = opts?.maxRequests ?? maxRequests
    const window = opts?.windowMs ?? windowMs
    const namespacedKey = `ratelimit:${key}`
    const now = Date.now()

    // Pipeline: single round-trip for incr + pttl
    const pipeline = this.redis.pipeline()
    pipeline.incr(namespacedKey)
    pipeline.pttl(namespacedKey)
    const results = await pipeline.exec<[number, number]>()
    const count = results[0]
    let ttlMs = results[1]

    if (ttlMs < 0) {
      await this.redis.pexpire(namespacedKey, window)
      ttlMs = window
    }

    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: now + Math.max(ttlMs, 0),
      limit,
      store: this.kind,
    }
  }
}

const localRateLimitStore = new InMemoryRateLimitStore()

function createDefaultRateLimitStore(): RateLimitStore {
  if (env.REDIS_URL && env.REDIS_TOKEN) {
    return new UpstashRedisRateLimitStore(
      new Redis({
        url: env.REDIS_URL,
        token: env.REDIS_TOKEN,
      })
    )
  }

  if (getRuntimeBaseline().productionBaselineRequired) {
    throw new Error("Redis-backed rate limiting is required when APP_ENV is staging/production or RUNTIME_REQUIREMENTS_ENFORCED=true.")
  }

  return localRateLimitStore
}

let activeRateLimitStore: RateLimitStore = createDefaultRateLimitStore()

export function getRateLimitBackend(): string {
  return activeRateLimitStore.kind
}

export function setRateLimitStoreForTests(store: RateLimitStore | null): void {
  activeRateLimitStore = store ?? localRateLimitStore
}

async function rateLimitWithStore(
  key: string,
  opts?: RateLimitOptions
): Promise<RateLimitResult> {
  return activeRateLimitStore.increment(key, opts)
}

export function rateLimit(
  key: string,
  opts?: RateLimitOptions
): RateLimitResult {
  return localRateLimitStore.incrementSync(key, opts)
}

/**
 * Number of trusted reverse-proxy hops in front of the app (Vercel/edge/LBs).
 * Defaults to 1 (a single trusted proxy, e.g. Vercel). Configure via
 * TRUSTED_PROXY_HOPS if you sit behind additional trusted proxies.
 */
function trustedProxyHops(): number {
  const raw = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10)
  return Number.isFinite(raw) && raw >= 1 ? raw : 1
}

/**
 * Resolve the client IP for rate-limit keying.
 *
 * The LEFTMOST `X-Forwarded-For` entry is client-controlled: a caller can
 * prepend an arbitrary IP to mint a fresh rate-limit bucket on every request,
 * defeating brute-force limits on login / MFA / password-reset. The only
 * trustworthy entries are the rightmost ones appended by our own infrastructure.
 * With N trusted proxies, the real client IP is the entry N positions from the
 * right (index `len - N`).
 */
export function resolveClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) {
      const idx = Math.max(0, parts.length - trustedProxyHops())
      const ip = parts[idx] ?? parts[parts.length - 1]
      if (ip) return ip
    }
  }
  // x-real-ip is set by the trusted proxy (not forwardable through it).
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

function tooManyRequests(result: RateLimitResult, route: string): NextResponse {
  rateLimitBlockedCounter.add(1, { route })
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Backend": result.store,
      },
    }
  )
}

/**
 * Rate-limit against an explicit key (e.g. `mfa-verify:${userId}`). Prefer this
 * for per-principal limits that must not be bypassable by IP rotation.
 */
export async function applyRateLimitByKey(
  key: string,
  opts?: RateLimitOptions
): Promise<NextResponse | null> {
  const result = await rateLimitWithStore(key, opts)
  return result.success ? null : tooManyRequests(result, key)
}

/**
 * Returns a 429 response if the caller exceeds the rate limit.
 * Use at the top of API route handlers:
 *   const blocked = await applyRateLimit(request)
 *   if (blocked) return blocked
 */
export async function applyRateLimit(
  request: Request,
  opts?: RateLimitOptions
): Promise<NextResponse | null> {
  const ip = resolveClientIp(request)
  const url = new URL(request.url).pathname

  const result = await rateLimitWithStore(`${ip}:${url}`, opts)

  if (!result.success) {
    // Fire-and-forget abuse monitoring
    recordRateLimitBlock(ip, url).catch(() => {})
    return tooManyRequests(result, url)
  }

  return null // not blocked
}
