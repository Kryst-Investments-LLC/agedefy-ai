import { describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { readDbPoolMetrics } from "@/lib/observability/db-pool-gauge"

// Verifies the Prisma $metrics bridge on a real connection pool (DB-pool SLO,
// OBS-004). Requires the `metrics` preview feature on the generated client.

describe("readDbPoolMetrics (P0-OBS-004 DB-pool SLI)", () => {
  it("reports live pool gauges from Prisma $metrics", async () => {
    // Force at least one open connection.
    await db.$queryRaw`SELECT 1`

    const snapshot = await readDbPoolMetrics()

    // The pool has opened at least one connection to serve the query above.
    expect(snapshot.connectionsOpen).toBeGreaterThanOrEqual(1)
    // open == busy + idle should hold for the pool.
    expect(snapshot.connectionsBusy + snapshot.connectionsIdle).toBe(snapshot.connectionsOpen)
    // Saturation signal is a non-negative count.
    expect(snapshot.queriesWait).toBeGreaterThanOrEqual(0)
    expect(snapshot.queriesActive).toBeGreaterThanOrEqual(0)
  })
})
