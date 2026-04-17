"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  adminOrchestrationAutoRefreshOptions,
  adminOrchestrationQueueOrder,
  adminOrchestrationStaleThresholdMinutes,
  buildAdminJobsApiPath,
  formatAdminOrchestrationAge,
  getAdminOrchestrationQueueStaleness,
  getAdminOrchestrationQueueTone,
  summarizeAdminOrchestrationQueues,
  type AdminOrchestrationQueueFilter,
  type AdminOrchestrationQueueSummary,
  type AdminOrchestrationSummaryResponse,
} from "@/lib/admin-orchestration-summary"

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error ?? "Request failed")
  }

  return body as T
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "None"
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return "Invalid timestamp"
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)
}

function queueToneClasses(summary: AdminOrchestrationQueueSummary) {
  switch (getAdminOrchestrationQueueTone(summary)) {
    case "critical":
      return {
        badge: "border-red-500/40 bg-red-500/15 text-red-100",
        border: "border-red-900/80",
      }
    case "active":
      return {
        badge: "border-amber-500/40 bg-amber-500/15 text-amber-100",
        border: "border-amber-900/70",
      }
    default:
      return {
        badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
        border: "border-emerald-950/70",
      }
  }
}

function SummaryStat({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-400">{label}</p>
        <div className="text-gray-500">{icon}</div>
      </div>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}

export function AdminOrchestrationOverview() {
  const [payload, setPayload] = useState<AdminOrchestrationSummaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [queueFilter, setQueueFilter] = useState<AdminOrchestrationQueueFilter>("ALL")
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(0)

  async function loadSummary() {
    setError(null)
    setIsLoading(true)

    try {
      const nextPayload = await requestJson<AdminOrchestrationSummaryResponse>("/api/admin/jobs/summary")
      setPayload(nextPayload)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load orchestration summary")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSummary()
  }, [])

  useEffect(() => {
    if (autoRefreshSeconds <= 0) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      void loadSummary()
    }, autoRefreshSeconds * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [autoRefreshSeconds])

  const summary = payload?.summary ?? null
  const queueSummaries = adminOrchestrationQueueOrder
    .map((queue) => summary?.queues[queue] ?? null)
    .filter((queueSummary): queueSummary is AdminOrchestrationQueueSummary => queueSummary !== null)
  const visibleQueueSummaries = queueFilter === "ALL"
    ? queueSummaries
    : queueSummaries.filter((queueSummary) => queueSummary.queue === queueFilter)
  const visibleSummary = summarizeAdminOrchestrationQueues(visibleQueueSummaries)
  const staleQueueCount = visibleQueueSummaries.filter((queueSummary) => getAdminOrchestrationQueueStaleness(queueSummary).isStale).length
  const rawJobsPath = queueFilter === "ALL" ? buildAdminJobsApiPath() : buildAdminJobsApiPath({ queue: queueFilter })
  const generatedAgeLabel = payload ? formatAdminOrchestrationAge(payload.generatedAt) : null

  return (
    <section className="mb-10 rounded-3xl border border-gray-800 bg-gray-950 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Durable orchestration operations</h2>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Review backlog, in-flight work, and dead-letter pressure across AI, ingestion, notification, and governance queues without scanning the raw job list first.
          </p>
          {payload ? (
            <p className="mt-3 text-xs text-gray-500">
              Tenant {payload.tenantId} · generated {formatTimestamp(payload.generatedAt)}{generatedAgeLabel ? ` (${generatedAgeLabel})` : ""}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-gray-500">
            {queueFilter === "ALL" ? `Showing ${visibleSummary.queueCount} queues` : `Showing ${queueFilter} queue`} · stale threshold {adminOrchestrationStaleThresholdMinutes} minutes · {autoRefreshSeconds > 0 ? `auto-refresh every ${autoRefreshSeconds} seconds` : "manual refresh"}
            {staleQueueCount > 0 ? ` · ${staleQueueCount} queue${staleQueueCount > 1 ? "s" : ""} stale` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[11rem]">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-gray-500">Queue filter</p>
            <Select value={queueFilter} onValueChange={(value) => setQueueFilter(value as AdminOrchestrationQueueFilter)}>
              <SelectTrigger className="border-gray-700 bg-gray-900 text-gray-100">
                <SelectValue placeholder="Select queue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All queues</SelectItem>
                {adminOrchestrationQueueOrder.map((queue) => (
                  <SelectItem key={queue} value={queue}>{queue}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[11rem]">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-gray-500">Refresh cadence</p>
            <Select value={`${autoRefreshSeconds}`} onValueChange={(value) => setAutoRefreshSeconds(Number(value))}>
              <SelectTrigger className="border-gray-700 bg-gray-900 text-gray-100">
                <SelectValue placeholder="Refresh cadence" />
              </SelectTrigger>
              <SelectContent>
                {adminOrchestrationAutoRefreshOptions.map((option) => (
                  <SelectItem key={option.seconds} value={`${option.seconds}`}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-gray-700 text-gray-100 hover:bg-gray-800"
            onClick={() => void loadSummary()}
            disabled={isLoading}
          >
            <RefreshCcw className={`mr-2 h-4 w-4${isLoading ? " animate-spin" : ""}`} />
            Refresh summary
          </Button>
          <Link href={rawJobsPath} target="_blank">
            <Button variant="ghost" className="text-gray-200 hover:bg-gray-800">Open raw jobs</Button>
          </Link>
          <Link href="/api/admin/jobs/summary" target="_blank">
            <Button variant="ghost" className="text-gray-200 hover:bg-gray-800">Open raw summary</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-900 bg-red-950/70 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStat label="Backlog" value={visibleSummary.backlogCount} icon={<Clock3 className="h-4 w-4" />} />
        <SummaryStat label="In flight" value={visibleSummary.inFlightCount} icon={<Activity className="h-4 w-4" />} />
        <SummaryStat label="Dead-letter" value={visibleSummary.deadLetterCount} icon={<AlertTriangle className="h-4 w-4" />} />
        <SummaryStat label="Terminal" value={visibleSummary.terminalCount} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {visibleQueueSummaries.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-400">
            No queues match the current filter.
          </div>
        ) : null}

        {adminOrchestrationQueueOrder.map((queue) => {
          const queueSummary = visibleQueueSummaries.find((candidate) => candidate.queue === queue) ?? null

          if (!queueSummary) {
            if (queueFilter !== "ALL") {
              return null
            }

            return (
              <div key={queue} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">{queue}</h3>
                  <Badge variant="outline" className="border-gray-700 text-gray-300">Loading</Badge>
                </div>
                <p className="mt-4 text-sm text-gray-500">{isLoading ? "Loading queue metrics..." : "Queue metrics unavailable."}</p>
              </div>
            )
          }

          const tone = queueToneClasses(queueSummary)
          const staleness = getAdminOrchestrationQueueStaleness(queueSummary)
          const queueTone = getAdminOrchestrationQueueTone(queueSummary)
          const stateLabel = queueTone === "critical"
            ? "Needs intervention"
            : staleness.isStale
              ? "Stale backlog"
              : queueTone === "active"
                ? "Active"
                : "Idle"
          const staleReasons = [
            staleness.backlog.isStale && staleness.backlog.ageLabel
              ? `Oldest backlog ${staleness.backlog.ageLabel}`
              : null,
            staleness.deadLetter.isStale && staleness.deadLetter.ageLabel
              ? `Oldest dead-letter ${staleness.deadLetter.ageLabel}`
              : null,
          ].filter((reason): reason is string => Boolean(reason))

          return (
            <div key={queue} className={`rounded-2xl border bg-gray-900 p-5 ${tone.border}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{queueSummary.queue}</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    Queued {queueSummary.counts.QUEUED} · Failed {queueSummary.counts.FAILED} · Dead-letter {queueSummary.counts.DEAD_LETTER}
                  </p>
                </div>
                <Badge variant="outline" className={tone.badge}>
                  {stateLabel}
                </Badge>
              </div>

              {staleReasons.length > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  {staleReasons.join(" · ")} exceeds the {staleness.staleAfterMinutes}-minute review threshold.
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Backlog</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{queueSummary.backlogCount}</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">In flight</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{queueSummary.inFlightCount}</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Dead-letter</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{queueSummary.deadLetterCount}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-gray-300 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Oldest backlog</p>
                  <p className="mt-2">{formatTimestamp(queueSummary.oldestBacklogAt)}</p>
                  {staleness.backlog.ageLabel ? <p className="mt-1 text-xs text-gray-500">{staleness.backlog.ageLabel}</p> : null}
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">Oldest dead-letter</p>
                  <p className="mt-2">{formatTimestamp(queueSummary.oldestDeadLetterAt)}</p>
                  {staleness.deadLetter.ageLabel ? <p className="mt-1 text-xs text-gray-500">{staleness.deadLetter.ageLabel}</p> : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={buildAdminJobsApiPath({ queue })} target="_blank">
                  <Button variant="outline" className="border-gray-700 text-gray-100 hover:bg-gray-800">Inspect queue</Button>
                </Link>
                <Link href={buildAdminJobsApiPath({ queue, status: "DEAD_LETTER" })} target="_blank">
                  <Button variant="ghost" className="text-gray-200 hover:bg-gray-800">Open dead-letter</Button>
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}