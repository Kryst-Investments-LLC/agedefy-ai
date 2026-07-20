import { describe, expect, it } from "vitest"

import { getRuntimeBaseline, parseEnvironment, shouldEnforceRuntimeRequirements } from "@/lib/env"

const validSecret = "development-secret-change-me-before-production"

describe("runtime baseline", () => {
  it("does not enforce the production baseline for local sqlite development", () => {
    const baseline = getRuntimeBaseline({
      DATABASE_URL: "file:./prisma/dev.db",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: validSecret,
      APP_ENV: "development",
    })

    expect(baseline.productionBaselineRequired).toBe(false)
    expect(baseline.databaseProvider).toBe("sqlite")
    expect(baseline.issues).toHaveLength(0)
  })

  it("requires postgres, redis, and otel in enforced staging runtimes", () => {
    const baseline = getRuntimeBaseline({
      DATABASE_URL: "file:./prisma/dev.db",
      NEXTAUTH_URL: "https://staging.biozephyra.com",
      NEXTAUTH_SECRET: validSecret,
      APP_ENV: "staging",
      RUNTIME_REQUIREMENTS_ENFORCED: "true",
    })

    expect(shouldEnforceRuntimeRequirements({ APP_ENV: "staging" })).toBe(true)
    expect(baseline.issues.map((issue) => issue.code)).toEqual([
      "database.postgres_required",
      "ratelimit.redis_required",
      "observability.otel_required",
      "cron.secret_required",
      "auth.test_endpoint_forbidden",
    ])
  })

  it("accepts a postgres-backed staging configuration with distributed controls", () => {
    const baseline = getRuntimeBaseline({
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/Biozephyra?schema=public",
      NEXTAUTH_URL: "https://staging.biozephyra.com",
      NEXTAUTH_SECRET: validSecret,
      APP_ENV: "staging",
      REDIS_URL: "https://example.upstash.io",
      REDIS_TOKEN: "token",
      OTEL_SERVICE_NAME: "biozephyra-ai-staging",
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com/v1/traces",
      CRON_SECRET: "staging-cron-secret-material-change-before-production",
      ENABLE_TEST_AUTH_ENDPOINT: "false",
    })

    expect(baseline.productionBaselineRequired).toBe(true)
    expect(baseline.databaseProvider).toBe("postgresql")
    expect(baseline.prismaRuntime).toBe("postgres")
    expect(baseline.issues).toHaveLength(0)
  })

  it("fails closed when enabled integrations are missing dependencies", () => {
    const baseline = getRuntimeBaseline({
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/agedefy",
      APP_ENV: "production",
      REDIS_URL: "https://redis.example.com",
      REDIS_TOKEN: "token",
      OTEL_SERVICE_NAME: "agedefy",
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.com",
      CRON_SECRET: "production-cron-secret-material-change-me",
      ENABLE_TEST_AUTH_ENDPOINT: "false",
      SSO_ENABLED: "true",
      ENABLE_FEDERATED_LEARNING: "true",
      ENABLE_CAUSAL_SIDECAR: "true",
      ENABLE_NEO4J_BACKEND: "true",
      ENABLE_SCREENING_SIDECAR: "true",
      ENABLE_OPENMM_SIDECAR: "true",
      ENABLE_FEP_SIDECAR: "true",
    })

    expect(baseline.issues.map((issue) => issue.code)).toEqual([
      "integration.sso_configuration_required",
      "integration.federated_learning_url_required",
      "integration.causal_sidecar_url_required",
      "integration.neo4j_configuration_required",
      "integration.screening_sidecar_url_required",
      "integration.openmm_sidecar_url_required",
      "integration.fep_sidecar_url_required",
    ])
  })

  it("parses optional postgres runtime environment variables", () => {
    const parsed = parseEnvironment({
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/Biozephyra?schema=public",
      POSTGRES_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/Biozephyra?schema=public",
      POSTGRES_SHADOW_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/biozephyra_shadow?schema=public",
      NEXTAUTH_URL: "https://app.biozephyra.com",
      NEXTAUTH_SECRET: validSecret,
      PRISMA_RUNTIME: "postgres",
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      throw new Error("Expected runtime environment parsing to succeed")
    }

    expect(parsed.data.POSTGRES_DATABASE_URL).toContain("postgresql://")
    expect(parsed.data.PRISMA_RUNTIME).toBe("postgres")
  })
})
