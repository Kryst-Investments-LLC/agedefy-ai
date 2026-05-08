import { describe, expect, it } from "vitest"

import {
  buildAdminJobsApiPath,
  formatAdminOrchestrationAge,
  getAdminOrchestrationQueueStaleness,
  getAdminOrchestrationQueueTone,
  summarizeAdminOrchestrationQueues,
} from "@/lib/admin-orchestration-summary"

describe("admin orchestration summary helpers", () => {
  it("builds raw jobs links with queue and status filters", () => {
    expect(buildAdminJobsApiPath({ queue: "AI", status: "DEAD_LETTER" })).toBe("/api/admin/jobs?queue=AI&status=DEAD_LETTER")
    expect(buildAdminJobsApiPath({ queue: "INGESTION" })).toBe("/api/admin/jobs?queue=INGESTION")
    expect(buildAdminJobsApiPath()).toBe("/api/admin/jobs")
  })

  it("assigns critical tone when dead-letter pressure exists", () => {
    expect(getAdminOrchestrationQueueTone({ deadLetterCount: 2, backlogCount: 0, inFlightCount: 0 })).toBe("critical")
    expect(getAdminOrchestrationQueueTone({ deadLetterCount: 0, backlogCount: 3, inFlightCount: 0 })).toBe("active")
    expect(getAdminOrchestrationQueueTone({ deadLetterCount: 0, backlogCount: 0, inFlightCount: 0 })).toBe("idle")
  })

  it("aggregates visible queue counts for filtered dashboard views", () => {
    const summary = summarizeAdminOrchestrationQueues([
      {
        queue: "AI",
        counts: {
          QUEUED: 2,
          LEASED: 1,
          SUCCEEDED: 5,
          FAILED: 1,
          DEAD_LETTER: 0,
          CANCELED: 0,
        },
        backlogCount: 3,
        deadLetterCount: 0,
        inFlightCount: 1,
        terminalCount: 6,
        oldestBacklogAt: null,
        oldestDeadLetterAt: null,
      },
      {
        queue: "INGESTION",
        counts: {
          QUEUED: 1,
          LEASED: 0,
          SUCCEEDED: 2,
          FAILED: 0,
          DEAD_LETTER: 1,
          CANCELED: 1,
        },
        backlogCount: 1,
        deadLetterCount: 1,
        inFlightCount: 0,
        terminalCount: 4,
        oldestBacklogAt: null,
        oldestDeadLetterAt: null,
      },
    ])

    expect(summary.queueCount).toBe(2)
    expect(summary.backlogCount).toBe(4)
    expect(summary.deadLetterCount).toBe(1)
    expect(summary.inFlightCount).toBe(1)
    expect(summary.terminalCount).toBe(10)
    expect(summary.totals.QUEUED).toBe(3)
    expect(summary.totals.DEAD_LETTER).toBe(1)
  })

  it("flags stale backlog and dead-letter timestamps", () => {
    const now = new Date("2026-01-01T12:00:00.000Z").getTime()
    const staleness = getAdminOrchestrationQueueStaleness(
      {
        backlogCount: 2,
        deadLetterCount: 1,
        oldestBacklogAt: "2026-01-01T11:10:00.000Z",
        oldestDeadLetterAt: "2026-01-01T10:20:00.000Z",
      },
      { now, staleAfterMinutes: 30 },
    )

    expect(staleness.isStale).toBe(true)
    expect(staleness.backlog.isStale).toBe(true)
    expect(staleness.backlog.ageLabel).toBe("50m old")
    expect(staleness.deadLetter.isStale).toBe(true)
    expect(staleness.deadLetter.ageLabel).toBe("1h old")
  })

  it("formats human-readable age labels", () => {
    const now = new Date("2026-01-01T12:00:00.000Z").getTime()

    expect(formatAdminOrchestrationAge("2026-01-01T11:59:30.000Z", now)).toBe("just now")
    expect(formatAdminOrchestrationAge("2026-01-01T11:15:00.000Z", now)).toBe("45m old")
    expect(formatAdminOrchestrationAge("2026-01-01T09:15:00.000Z", now)).toBe("2h old")
  })
})