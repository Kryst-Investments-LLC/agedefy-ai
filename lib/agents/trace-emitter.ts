import { recordCacheEviction } from '@/lib/observability/cache-metrics'

import type { TraceEvent, TraceEmitter } from './types'

const TRACE_CACHE_NAME = 'agent_trace_history'

type TraceListener = (event: TraceEvent) => void

const sessionListeners = new Map<string, Set<TraceListener>>()
const sessionTraces = new Map<string, TraceEvent[]>()

const MAX_TRACE_HISTORY = 200
const TRACE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export function createTraceEmitter(sessionId: string): TraceEmitter {
  return (partial) => {
    const event: TraceEvent = {
      id: crypto.randomUUID(),
      sessionId,
      timestamp: new Date().toISOString(),
      ...partial,
    }

    // Store in history
    let history = sessionTraces.get(sessionId)
    if (!history) {
      history = []
      sessionTraces.set(sessionId, history)
    }
    history.push(event)
    if (history.length > MAX_TRACE_HISTORY) {
      recordCacheEviction(TRACE_CACHE_NAME, history.length - MAX_TRACE_HISTORY)
      history.splice(0, history.length - MAX_TRACE_HISTORY)
    }

    // Notify listeners
    const listeners = sessionListeners.get(sessionId)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event)
        } catch {
          // Don't let a bad listener break the agent
        }
      }
    }
  }
}

export function subscribeToTrace(sessionId: string, listener: TraceListener): () => void {
  let listeners = sessionListeners.get(sessionId)
  if (!listeners) {
    listeners = new Set()
    sessionListeners.set(sessionId, listeners)
  }
  listeners.add(listener)

  return () => {
    listeners!.delete(listener)
    if (listeners!.size === 0) {
      sessionListeners.delete(sessionId)
    }
  }
}

export function getTraceHistory(sessionId: string): TraceEvent[] {
  return sessionTraces.get(sessionId) ?? []
}

export function clearTraceHistory(sessionId: string): void {
  sessionTraces.delete(sessionId)
  sessionListeners.delete(sessionId)
}

// Periodic cleanup of stale trace data
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - TRACE_TTL_MS
    for (const [sessionId, events] of sessionTraces) {
      if (events.length === 0) {
        sessionTraces.delete(sessionId)
        continue
      }
      const lastEvent = events[events.length - 1]
      if (new Date(lastEvent.timestamp).getTime() < cutoff) {
        recordCacheEviction(TRACE_CACHE_NAME, events.length)
        sessionTraces.delete(sessionId)
        sessionListeners.delete(sessionId)
      }
    }
  }, 5 * 60 * 1000)
  // Don't keep the event loop alive solely for cleanup (e.g. in tests/CLI).
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    ;(cleanupTimer as { unref: () => void }).unref()
  }
}
