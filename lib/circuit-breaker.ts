import { DependencyCircuitBreakerState } from "@prisma/client"

import { db } from "@/lib/db"
import { recordCacheEviction, recordCacheHit, recordCacheMiss } from "@/lib/observability/cache-metrics"
import { circuitBreakerStateChangeCounter } from "@/lib/observability/telemetry"

const CB_CACHE_NAME = "circuit_breaker_state"

type ExecuteWithCircuitBreakerArgs<T> = {
  dependency: string
  failureThreshold?: number
  cooldownMs?: number
  execute: () => Promise<T>
}

export class CircuitBreakerOpenError extends Error {
  dependency: string
  retryAt?: Date

  constructor(dependency: string, retryAt?: Date) {
    super(`${dependency} is temporarily unavailable due to repeated upstream failures.`)
    this.name = "CircuitBreakerOpenError"
    this.dependency = dependency
    this.retryAt = retryAt
  }
}

const DEFAULT_FAILURE_THRESHOLD = 3
const DEFAULT_COOLDOWN_MS = 30_000

// ── In-memory circuit breaker state cache ──────────────────────────────
// Avoids a DB round-trip on every external call for the common success path.
// DB is only consulted on cold start and written on state transitions.
interface CachedCBState {
  state: DependencyCircuitBreakerState
  failureCount: number
  nextAttemptAt: Date | null
  cachedAt: number
}

const CB_CACHE_TTL_MS = 10_000 // refresh from DB at most every 10s
// Source-of-truth is the DependencyCircuitBreaker table; this Map is a small
// read-through cache keyed by the (finite) set of dependency names. The cap
// is defense-in-depth in case a buggy caller starts generating dynamic names.
const CB_CACHE_MAX_ENTRIES = 1_000
const cbCache = new Map<string, CachedCBState>()

function setCachedState(dependency: string, entry: CachedCBState) {
  if (!cbCache.has(dependency) && cbCache.size >= CB_CACHE_MAX_ENTRIES) {
    const firstKey = cbCache.keys().next().value
    if (firstKey !== undefined) {
      cbCache.delete(firstKey)
      recordCacheEviction(CB_CACHE_NAME)
    }
  }
  cbCache.set(dependency, entry)
}

async function getCachedState(dependency: string): Promise<CachedCBState | null> {
  const cached = cbCache.get(dependency)
  if (cached && Date.now() - cached.cachedAt < CB_CACHE_TTL_MS) {
    recordCacheHit(CB_CACHE_NAME)
    return cached
  }
  recordCacheMiss(CB_CACHE_NAME)

  const row = await db.dependencyCircuitBreaker.findUnique({ where: { dependency } })
  if (!row) return null

  const entry: CachedCBState = {
    state: row.state,
    failureCount: row.failureCount,
    nextAttemptAt: row.nextAttemptAt,
    cachedAt: Date.now(),
  }
  setCachedState(dependency, entry)
  return entry
}

function updateCache(dependency: string, state: DependencyCircuitBreakerState, failureCount: number, nextAttemptAt: Date | null) {
  setCachedState(dependency, { state, failureCount, nextAttemptAt, cachedAt: Date.now() })
}

export async function executeWithCircuitBreaker<T>({
  dependency,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  execute,
}: ExecuteWithCircuitBreakerArgs<T>): Promise<T> {
  const now = new Date()
  const existing = await getCachedState(dependency)

  if (existing?.state === DependencyCircuitBreakerState.OPEN && existing.nextAttemptAt && existing.nextAttemptAt > now) {
    throw new CircuitBreakerOpenError(dependency, existing.nextAttemptAt)
  }

  if (existing?.state === DependencyCircuitBreakerState.OPEN) {
    await db.dependencyCircuitBreaker.update({
      where: { dependency },
      data: {
        state: DependencyCircuitBreakerState.HALF_OPEN,
      },
    })
    updateCache(dependency, DependencyCircuitBreakerState.HALF_OPEN, existing.failureCount, null)
  }

  try {
    const result = await execute()

    // Only write to DB on state transition (HALF_OPEN → CLOSED or first success)
    const wasHealthy = existing?.state === DependencyCircuitBreakerState.CLOSED
    if (!wasHealthy) {
      await db.dependencyCircuitBreaker.upsert({
        where: { dependency },
        update: {
          state: DependencyCircuitBreakerState.CLOSED,
          failureCount: 0,
          successCount: { increment: 1 },
          lastSuccessAt: now,
          lastError: null,
          openedAt: null,
          nextAttemptAt: null,
        },
        create: {
          dependency,
          state: DependencyCircuitBreakerState.CLOSED,
          failureCount: 0,
          successCount: 1,
          lastSuccessAt: now,
        },
      })
    }
    updateCache(dependency, DependencyCircuitBreakerState.CLOSED, 0, null)

    return result
  } catch (error) {
    const nextFailureCount = existing?.state === DependencyCircuitBreakerState.HALF_OPEN
      ? failureThreshold
      : (existing?.failureCount ?? 0) + 1
    const shouldOpen = nextFailureCount >= failureThreshold
    const retryAt = shouldOpen ? new Date(now.getTime() + cooldownMs) : null
    const nextState = shouldOpen ? DependencyCircuitBreakerState.OPEN : DependencyCircuitBreakerState.CLOSED

    await db.dependencyCircuitBreaker.upsert({
      where: { dependency },
      update: {
        state: nextState,
        failureCount: nextFailureCount,
        lastFailureAt: now,
        lastError: error instanceof Error ? error.message : String(error),
        openedAt: shouldOpen ? now : null,
        nextAttemptAt: retryAt,
      },
      create: {
        dependency,
        state: nextState,
        failureCount: nextFailureCount,
        lastFailureAt: now,
        lastError: error instanceof Error ? error.message : String(error),
        openedAt: shouldOpen ? now : null,
        nextAttemptAt: retryAt,
      },
    })
    updateCache(dependency, nextState, nextFailureCount, retryAt)

    if (shouldOpen) {
      circuitBreakerStateChangeCounter.add(1, { dependency, state: "open" })
    }

    throw error
  }
}

/**
 * Clear the in-memory circuit breaker cache.
 * For use in tests only.
 */
export function resetCircuitBreakerCache() {
  cbCache.clear()
}