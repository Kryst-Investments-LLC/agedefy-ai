"use client"

import { useEffect, useState } from "react"

/**
 * INT-008: honest degraded-state banner. Shows only when a governed AI provider's
 * circuit breaker is open (from /api/ai/status); renders nothing in normal
 * operation and auto-clears when the provider recovers. Polls once a minute.
 */
export function AiServiceBanner() {
  const [degraded, setDegraded] = useState(false)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const check = async () => {
      try {
        const res = await fetch("/api/ai/status", { cache: "no-store", signal: controller.signal })
        if (!res.ok) return
        const data = (await res.json()) as { degraded?: boolean }
        if (active) setDegraded(Boolean(data.degraded))
      } catch {
        // Network error / abort — keep the current state; never fabricate an outage.
      }
    }

    void check()
    const timer = setInterval(() => void check(), 60_000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  if (!degraded) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      AI features are temporarily unavailable due to a provider outage. We&rsquo;re
      retrying automatically — please try again shortly.
    </div>
  )
}
