import { describe, expect, it } from "vitest"

import {
  assertNoDevFallbacksInProduction,
  getConfigFingerprint,
  getRuntimeBaseline,
  parseEnvironment,
  shouldEnforceRuntimeRequirements,
} from "@/lib/env"

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

  it("flags plaintext-secret emergency overrides left active in an enforced baseline", () => {
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
      SCREENING_ADAPTER_ALLOW_PLAINTEXT: "true",
      MFA_ALLOW_PLAINTEXT_FALLBACK: "true",
    })

    const codes = baseline.issues.map((issue) => issue.code)
    expect(codes).toContain("secrets.screening_plaintext_override_active")
    expect(codes).toContain("secrets.mfa_plaintext_override_active")
  })

  it("does not flag plaintext overrides when they are absent or explicitly false", () => {
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
      SCREENING_ADAPTER_ALLOW_PLAINTEXT: "false",
    })

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

  describe("assertNoDevFallbacksInProduction (P0-CFG-004/005)", () => {
    const realSecret = "x".repeat(40)
    const pgUrl = "postgresql://postgres@127.0.0.1:5432/agedefy"

    it("throws in production without a real NEXTAUTH_SECRET (refuses the dev fallback)", () => {
      expect(() =>
        assertNoDevFallbacksInProduction({ DATABASE_URL: pgUrl, NEXTAUTH_SECRET: "short" }, "production"),
      ).toThrow(/NEXTAUTH_SECRET/)
      expect(() =>
        assertNoDevFallbacksInProduction({ DATABASE_URL: pgUrl }, "production"),
      ).toThrow(/NEXTAUTH_SECRET/)
    })

    it("throws in production without a database URL (refuses the SQLite fallback)", () => {
      expect(() =>
        assertNoDevFallbacksInProduction({ NEXTAUTH_SECRET: realSecret }, "production"),
      ).toThrow(/DATABASE_URL/)
    })

    it("passes in production with a real secret and database URL", () => {
      expect(() =>
        assertNoDevFallbacksInProduction({ NEXTAUTH_SECRET: realSecret, DATABASE_URL: pgUrl }, "production"),
      ).not.toThrow()
      expect(() =>
        assertNoDevFallbacksInProduction({ NEXTAUTH_SECRET: realSecret, POSTGRES_DATABASE_URL: pgUrl }, "production"),
      ).not.toThrow()
    })

    it("is a no-op outside production (dev/test keep their conveniences)", () => {
      expect(() => assertNoDevFallbacksInProduction({}, "development")).not.toThrow()
      expect(() => assertNoDevFallbacksInProduction({}, "test")).not.toThrow()
      expect(() => assertNoDevFallbacksInProduction({}, undefined)).not.toThrow()
    })
  })

  describe("getConfigFingerprint (P1-CFG-008)", () => {
    const base = {
      DATABASE_URL: "postgresql://postgres:pw@127.0.0.1:5432/agedefy",
      NEXTAUTH_URL: "https://app.biozephyra.com",
      NEXTAUTH_SECRET: validSecret,
      APP_ENV: "production" as const,
    }

    it("is stable for the same config shape", () => {
      expect(getConfigFingerprint(base)).toBe(getConfigFingerprint({ ...base }))
    })

    it("changes when a non-secret dimension drifts", () => {
      const changed = getConfigFingerprint({ ...base, APP_ENV: "staging" })
      expect(changed).not.toBe(getConfigFingerprint(base))
    })

    it("changes when the resolved database provider drifts", () => {
      const sqlite = getConfigFingerprint({ ...base, DATABASE_URL: "file:./dev.db" })
      expect(sqlite).not.toBe(getConfigFingerprint(base))
    })

    it("does NOT change when only a secret's value rotates (presence is unchanged)", () => {
      const rotated = getConfigFingerprint({ ...base, NEXTAUTH_SECRET: "y".repeat(40) })
      expect(rotated).toBe(getConfigFingerprint(base))
    })

    it("changes when a secret appears or disappears (real topology drift)", () => {
      const withCron = getConfigFingerprint({ ...base, CRON_SECRET: "z".repeat(40) })
      expect(withCron).not.toBe(getConfigFingerprint(base))
    })

    it("never embeds a raw secret value in the fingerprint", () => {
      const secret = "super-secret-material-that-must-not-leak-1234"
      const fp = getConfigFingerprint({ ...base, NEXTAUTH_SECRET: secret, CRON_SECRET: secret })
      expect(fp).not.toContain(secret)
      expect(fp).toMatch(/^[0-9a-f]+$/)
    })
  })
})
