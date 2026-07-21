"use client"

import { useEffect, useState } from "react"

/**
 * INT-008: honest degraded-state banner. Shows only when a platform dependency's
 * circuit breaker is open (from /api/status), naming the affected categories
 * (AI features, Payments, Compound & structure data). Renders nothing in normal
 * operation and auto-clears on recovery. Polls once a minute.
 */
export function ServiceStatusBanner() {
  const [labels, setLabels] = useState<string[]>([])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const check = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store", signal: controller.signal })
        if (!res.ok) return
        const data = (await res.json()) as { degraded?: boolean; degradedLabels?: string[] }
        if (active) setLabels(data.degraded ? data.degradedLabels ?? [] : [])
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

  if (labels.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      Some services are temporarily degraded ({labels.join(", ")}). We&rsquo;re retrying
      automatically — please try again shortly.
    </div>
  )
}
