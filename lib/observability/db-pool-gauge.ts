import { metrics } from "@opentelemetry/api"

import { db } from "@/lib/db"
import type { PrismaClient } from "@prisma/client"

type MetricsClient = Pick<PrismaClient, "$metrics">

export interface DbPoolSnapshot {
  connectionsOpen: number
  connectionsBusy: number
  connectionsIdle: number
  queriesWait: number
  queriesActive: number
}

/**
 * Read the Prisma connection-pool gauges (DB-pool SLO, OBS-004). Prisma does not
 * expose a pool-max gauge, so saturation is signalled by `queriesWait` — queries
 * queued because every pooled connection is busy. Extracted from the gauge
 * callback so it is directly testable. Uses the `metrics` preview feature
 * (deprecated upstream but the only source of pool internals today).
 */
export async function readDbPoolMetrics(client: MetricsClient = db): Promise<DbPoolSnapshot> {
  const snapshot = await client.$metrics.json()
  const byKey = new Map(snapshot.gauges.map((g) => [g.key, g.value]))
  const get = (key: string) => byKey.get(key) ?? 0
  return {
    connectionsOpen: get("prisma_pool_connections_open"),
    connectionsBusy: get("prisma_pool_connections_busy"),
    connectionsIdle: get("prisma_pool_connections_idle"),
    queriesWait: get("prisma_client_queries_wait"),
    queriesActive: get("prisma_client_queries_active"),
  }
}

/**
 * Register observable gauges bridging the Prisma pool metrics into OTel. Called
 * from instrumentation.ts after the OTel SDK initializes. A single batch
 * callback reads `$metrics.json()` once per collection and observes all five
 * gauges; any error is swallowed so a scrape can never crash the process.
 */
export function registerDbPoolGauges(): void {
  const meter = metrics.getMeter("biozephyra")
  const open = meter.createObservableGauge("biozephyra.db.pool.connections_open", {
    description: "Open DB pool connections",
  })
  const busy = meter.createObservableGauge("biozephyra.db.pool.connections_busy", {
    description: "Busy (in-use) DB pool connections",
  })
  const idle = meter.createObservableGauge("biozephyra.db.pool.connections_idle", {
    description: "Idle DB pool connections",
  })
  const wait = meter.createObservableGauge("biozephyra.db.client.queries_wait", {
    description: "Queries waiting for a DB pool connection (pool-saturation signal)",
  })
  const active = meter.createObservableGauge("biozephyra.db.client.queries_active", {
    description: "Queries currently executing",
  })

  meter.addBatchObservableCallback(
    async (result) => {
      try {
        const s = await readDbPoolMetrics()
        result.observe(open, s.connectionsOpen)
        result.observe(busy, s.connectionsBusy)
        result.observe(idle, s.connectionsIdle)
        result.observe(wait, s.queriesWait)
        result.observe(active, s.queriesActive)
      } catch {
        // Swallow — never let an observability scrape crash the process.
      }
    },
    [open, busy, idle, wait, active],
  )
}
