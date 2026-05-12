import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { env, getRuntimeBaseline } from "@/lib/env"
import { probeSidecars } from "@/lib/health/sidecar-health"
import { getOrchestrationJobMetrics } from "@/lib/jobs/queue"
import { isOtelConfigured } from "@/lib/observability/otel"
import { getRateLimitBackend } from "@/lib/rate-limit"

export async function GET() {
  try {
    // Verify database connectivity with a lightweight query
    await db.$queryRaw`SELECT 1`
    const [jobMetrics, sidecars] = await Promise.all([
      getOrchestrationJobMetrics(),
      probeSidecars(),
    ])
    const runtimeBaseline = getRuntimeBaseline()
    const baselineSatisfied = runtimeBaseline.issues.length === 0
    const statusCode = runtimeBaseline.productionBaselineRequired && !baselineSatisfied ? 503 : 200
    const status = statusCode === 200 ? "healthy" : "degraded"

    return NextResponse.json(
      {
        status,
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          rateLimit: getRateLimitBackend(),
          observability: isOtelConfigured() ? "active" : runtimeBaseline.otelConfigured ? "configured-not-active" : "missing",
        },
        sidecars,
        runtime: {
          appEnv: runtimeBaseline.appEnv,
          productionBaselineRequired: runtimeBaseline.productionBaselineRequired,
          databaseProvider: runtimeBaseline.databaseProvider,
          prismaRuntime: runtimeBaseline.prismaRuntime,
          rateLimitBackend: getRateLimitBackend(),
          redisConfigured: runtimeBaseline.redisConfigured,
          observability: {
            otelConfigured: runtimeBaseline.otelConfigured,
            serviceName: env.OTEL_SERVICE_NAME ?? null,
            exporterConfigured: Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT),
          },
          issues: runtimeBaseline.issues,
        },
        orchestration: jobMetrics,
      },
      { status: statusCode },
    )
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        services: {
          database: "disconnected",
        },
      },
      { status: 503 },
    )
  }
}
