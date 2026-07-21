export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Production connection-pool guard (P1-PERF-013): warn if the DB URL has no
    // explicit connection_limit, since many instances each opening a default-size
    // pool can exhaust Postgres max_connections.
    if ((process.env.APP_ENV ?? process.env.NODE_ENV) === "production") {
      const { isConnectionLimitUnset } = await import("@/lib/db-pool")
      if (isConnectionLimitUnset(process.env.DATABASE_URL)) {
        console.warn(
          "[db-pool] DATABASE_URL has no connection_limit — Prisma will use its default pool per instance, " +
            "which can exhaust Postgres max_connections at scale. Set ?connection_limit=N per workload " +
            "(small for web, larger for workers).",
        )
      }
    }

    const { initOtelSdk } = await import("@/lib/observability/otel")
    const sdk = initOtelSdk()
    if (sdk) {
      const { registerJobQueueAgeGauge } = await import("@/lib/observability/job-queue-gauge")
      registerJobQueueAgeGauge()
      const { registerDbPoolGauges } = await import("@/lib/observability/db-pool-gauge")
      registerDbPoolGauges()
      console.log(
        `[otel] OpenTelemetry initialized — service=${process.env.OTEL_SERVICE_NAME || "biozephyra-ai"} endpoint=${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`,
      )
    }
  }
}
