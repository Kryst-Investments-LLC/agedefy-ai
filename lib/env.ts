import { z } from "zod"

const appEnvSchema = z.enum(["development", "test", "staging", "production"])

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  POSTGRES_DATABASE_URL: z.string().optional(),
  POSTGRES_SHADOW_DATABASE_URL: z.string().optional(),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  APP_ENV: appEnvSchema.optional(),
  RUNTIME_REQUIREMENTS_ENFORCED: z.enum(["true", "false"]).optional(),
  PRISMA_RUNTIME: z.enum(["sqlite", "postgres"]).optional(),
  ENABLE_TEST_AUTH_ENDPOINT: z.enum(["true", "false"]).optional(),
  ADMIN_EMAILS: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_GRAPH_PRICE_ID: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROK_API_KEY: z.string().optional(),
  PUBMED_EMAIL: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_TOKEN: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  SSO_ENABLED: z.enum(["true", "false"]).optional(),
  SSO_ISSUER: z.string().optional(),
  SSO_CLIENT_ID: z.string().optional(),
  SSO_CLIENT_SECRET: z.string().optional(),
  SCIM_SHARED_SECRET: z.string().optional(),
  MFA_ENCRYPTION_KEY: z.string().min(32).optional(),
  TENANCY_MODE: z.enum(["single", "shared", "isolated"]).optional(),
  DEFAULT_TENANT_ID: z.string().optional(),
  AI_GOVERNANCE_ENFORCED: z.enum(["true", "false"]).optional(),
  AI_REQUIRE_AUTH: z.enum(["true", "false"]).optional(),
  AI_ALLOWED_MODELS: z.string().optional(),
  JOB_WORKER_BATCH_SIZE: z.string().optional(),
  JOB_WORKER_POLL_INTERVAL_MS: z.string().optional(),
  JOB_WORKER_MAX_ATTEMPTS: z.string().optional(),
  JOB_WORKER_RETRY_DELAY_MS: z.string().optional(),
  JOB_WORKER_LEASE_MS: z.string().optional(),
  JOB_RETENTION_HOURS: z.string().optional(),
  JOB_TENANT_ID: z.string().optional(),
  CPIC_GUIDELINES_JSON_PATH: z.string().optional(),
  KG_BACKEND: z.enum(["relational", "neo4j"]).optional(),
  KG_NEO4J_URL: z.string().optional(),
  KG_NEO4J_USER: z.string().optional(),
  KG_NEO4J_PASSWORD: z.string().optional(),
  BIO_AGE_USE_OMICS: z.enum(["true", "false"]).optional(),
  // ─── Experimental / in-development feature gates (default OFF) ───────────
  ENABLE_FEDERATED_LEARNING: z.enum(["true", "false"]).optional(),
  ENABLE_CAUSAL_SIDECAR: z.enum(["true", "false"]).optional(),
  ENABLE_NEO4J_BACKEND: z.enum(["true", "false"]).optional(),
  ENABLE_SCREENING_SIDECAR: z.enum(["true", "false"]).optional(),
  ENABLE_OPENMM_SIDECAR: z.enum(["true", "false"]).optional(),
  ENABLE_FEP_SIDECAR: z.enum(["true", "false"]).optional(),
  FEP_SIDECAR_URL: z.string().optional(),
})

type ParsedEnvironment = z.infer<typeof envSchema>
export type AppEnvironment = z.infer<typeof appEnvSchema>

export type RuntimeBaselineIssue = {
  code: string
  message: string
}

export type RuntimeBaseline = {
  appEnv: AppEnvironment
  productionBaselineRequired: boolean
  databaseProvider: "sqlite" | "postgresql" | "unknown"
  databaseUrl: string
  prismaRuntime: "sqlite" | "postgres"
  redisConfigured: boolean
  otelConfigured: boolean
  issues: RuntimeBaselineIssue[]
}

function parseOptionalEnum<T extends string>(value: string | undefined, allowedValues: readonly T[]): T | undefined {
  if (!value) {
    return undefined
  }

  return allowedValues.includes(value as T) ? (value as T) : undefined
}

function readProcessEnvironment(): Partial<ParsedEnvironment> {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL,
    POSTGRES_SHADOW_DATABASE_URL: process.env.POSTGRES_SHADOW_DATABASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    APP_ENV: parseOptionalEnum(process.env.APP_ENV, ["development", "test", "staging", "production"]),
    RUNTIME_REQUIREMENTS_ENFORCED: parseOptionalEnum(process.env.RUNTIME_REQUIREMENTS_ENFORCED, ["true", "false"]),
    PRISMA_RUNTIME: parseOptionalEnum(process.env.PRISMA_RUNTIME, ["sqlite", "postgres"]),
    ENABLE_TEST_AUTH_ENDPOINT: parseOptionalEnum(process.env.ENABLE_TEST_AUTH_ENDPOINT, ["true", "false"]),
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_GRAPH_PRICE_ID: process.env.STRIPE_GRAPH_PRICE_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GROK_API_KEY: process.env.GROK_API_KEY,
    PUBMED_EMAIL: process.env.PUBMED_EMAIL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_TOKEN: process.env.REDIS_TOKEN,
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    SSO_ENABLED: parseOptionalEnum(process.env.SSO_ENABLED, ["true", "false"]),
    SSO_ISSUER: process.env.SSO_ISSUER,
    SSO_CLIENT_ID: process.env.SSO_CLIENT_ID,
    SSO_CLIENT_SECRET: process.env.SSO_CLIENT_SECRET,
    SCIM_SHARED_SECRET: process.env.SCIM_SHARED_SECRET,
    MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY,
    TENANCY_MODE: parseOptionalEnum(process.env.TENANCY_MODE, ["single", "shared", "isolated"]),
    DEFAULT_TENANT_ID: process.env.DEFAULT_TENANT_ID,
    AI_GOVERNANCE_ENFORCED: parseOptionalEnum(process.env.AI_GOVERNANCE_ENFORCED, ["true", "false"]),
    AI_REQUIRE_AUTH: parseOptionalEnum(process.env.AI_REQUIRE_AUTH, ["true", "false"]),
    AI_ALLOWED_MODELS: process.env.AI_ALLOWED_MODELS,
    JOB_WORKER_BATCH_SIZE: process.env.JOB_WORKER_BATCH_SIZE,
    JOB_WORKER_POLL_INTERVAL_MS: process.env.JOB_WORKER_POLL_INTERVAL_MS,
    JOB_WORKER_MAX_ATTEMPTS: process.env.JOB_WORKER_MAX_ATTEMPTS,
    JOB_WORKER_RETRY_DELAY_MS: process.env.JOB_WORKER_RETRY_DELAY_MS,
    JOB_WORKER_LEASE_MS: process.env.JOB_WORKER_LEASE_MS,
    JOB_RETENTION_HOURS: process.env.JOB_RETENTION_HOURS,
    JOB_TENANT_ID: process.env.JOB_TENANT_ID,
    ENABLE_FEDERATED_LEARNING: parseOptionalEnum(process.env.ENABLE_FEDERATED_LEARNING, ["true", "false"]),
    ENABLE_CAUSAL_SIDECAR: parseOptionalEnum(process.env.ENABLE_CAUSAL_SIDECAR, ["true", "false"]),
    ENABLE_NEO4J_BACKEND: parseOptionalEnum(process.env.ENABLE_NEO4J_BACKEND, ["true", "false"]),
    ENABLE_SCREENING_SIDECAR: parseOptionalEnum(process.env.ENABLE_SCREENING_SIDECAR, ["true", "false"]),
    ENABLE_OPENMM_SIDECAR: parseOptionalEnum(process.env.ENABLE_OPENMM_SIDECAR, ["true", "false"]),
    ENABLE_FEP_SIDECAR: parseOptionalEnum(process.env.ENABLE_FEP_SIDECAR, ["true", "false"]),
    FEP_SIDECAR_URL: process.env.FEP_SIDECAR_URL,
  }
}

export function parseEnvironment(input: Partial<ParsedEnvironment> = readProcessEnvironment()) {
  return envSchema.safeParse(input)
}

function resolveAppEnvironment(input: Partial<ParsedEnvironment>): AppEnvironment {
  const parsedAppEnv = appEnvSchema.safeParse(input.APP_ENV)
  if (parsedAppEnv.success) {
    return parsedAppEnv.data
  }

  if (process.env.NODE_ENV === "test") {
    return "test"
  }

  return "development"
}

function getEffectiveDatabaseUrl(input: Partial<ParsedEnvironment>): string {
  return input.POSTGRES_DATABASE_URL?.trim() || input.DATABASE_URL?.trim() || ""
}

function getDatabaseProvider(databaseUrl: string): RuntimeBaseline["databaseProvider"] {
  const normalizedUrl = databaseUrl.toLowerCase()

  if (normalizedUrl.startsWith("postgresql://") || normalizedUrl.startsWith("postgres://")) {
    return "postgresql"
  }

  if (normalizedUrl.startsWith("file:")) {
    return "sqlite"
  }

  return "unknown"
}

export function shouldEnforceRuntimeRequirements(input: Partial<ParsedEnvironment> = readProcessEnvironment()) {
  return input.RUNTIME_REQUIREMENTS_ENFORCED === "true" || ["staging", "production"].includes(resolveAppEnvironment(input))
}

export function getRuntimeBaseline(input: Partial<ParsedEnvironment> = readProcessEnvironment()): RuntimeBaseline {
  const appEnv = resolveAppEnvironment(input)
  const productionBaselineRequired = shouldEnforceRuntimeRequirements(input)
  const databaseUrl = getEffectiveDatabaseUrl(input)
  const databaseProvider = getDatabaseProvider(databaseUrl)
  const prismaRuntime = input.PRISMA_RUNTIME === "postgres" || databaseProvider === "postgresql" ? "postgres" : "sqlite"
  const redisConfigured = Boolean(input.REDIS_URL && input.REDIS_TOKEN)
  const otelConfigured = Boolean(input.OTEL_SERVICE_NAME && input.OTEL_EXPORTER_OTLP_ENDPOINT)
  const issues: RuntimeBaselineIssue[] = []

  if (productionBaselineRequired && databaseProvider !== "postgresql") {
    issues.push({
      code: "database.postgres_required",
      message: "Staging and production baselines require DATABASE_URL or POSTGRES_DATABASE_URL to use PostgreSQL.",
    })
  }

  if (productionBaselineRequired && !redisConfigured) {
    issues.push({
      code: "ratelimit.redis_required",
      message: "Staging and production baselines require REDIS_URL and REDIS_TOKEN for distributed rate limiting.",
    })
  }

  if (productionBaselineRequired && !otelConfigured) {
    issues.push({
      code: "observability.otel_required",
      message: "Staging and production baselines require OTEL_SERVICE_NAME and OTEL_EXPORTER_OTLP_ENDPOINT.",
    })
  }

  return {
    appEnv,
    productionBaselineRequired,
    databaseProvider,
    databaseUrl,
    prismaRuntime,
    redisConfigured,
    otelConfigured,
    issues,
  }
}

export function formatEnvironmentValidationError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`).join("; ")
}

export function formatRuntimeBaselineIssues(issues: RuntimeBaselineIssue[]) {
  return issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ")
}

const runtimeEnvInput = readProcessEnvironment()
const resolvedAppEnvironment = resolveAppEnvironment(runtimeEnvInput)
const parsedEnv = parseEnvironment(runtimeEnvInput)
const runtimeBaseline = getRuntimeBaseline(runtimeEnvInput)

if (resolvedAppEnvironment !== "test" && !runtimeEnvInput.MFA_ENCRYPTION_KEY?.trim()) {
  throw new Error("Invalid environment configuration: MFA_ENCRYPTION_KEY is required outside tests.")
}

if (!parsedEnv.success && shouldEnforceRuntimeRequirements()) {
  throw new Error(`Invalid environment configuration: ${formatEnvironmentValidationError(parsedEnv.error)}`)
}

if (shouldEnforceRuntimeRequirements() && runtimeBaseline.issues.length > 0) {
  throw new Error(`Invalid runtime baseline: ${formatRuntimeBaselineIssues(runtimeBaseline.issues)}`)
}

const fallbackEnv: ParsedEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL,
  POSTGRES_SHADOW_DATABASE_URL: process.env.POSTGRES_SHADOW_DATABASE_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "development-secret-change-me-before-production-32c",
  APP_ENV: parseOptionalEnum(process.env.APP_ENV, ["development", "test", "staging", "production"]),
  RUNTIME_REQUIREMENTS_ENFORCED: parseOptionalEnum(process.env.RUNTIME_REQUIREMENTS_ENFORCED, ["true", "false"]),
  PRISMA_RUNTIME: parseOptionalEnum(process.env.PRISMA_RUNTIME, ["sqlite", "postgres"]),
  ENABLE_TEST_AUTH_ENDPOINT: parseOptionalEnum(process.env.ENABLE_TEST_AUTH_ENDPOINT, ["true", "false"]),
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_GRAPH_PRICE_ID: process.env.STRIPE_GRAPH_PRICE_ID,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GROK_API_KEY: process.env.GROK_API_KEY,
  PUBMED_EMAIL: process.env.PUBMED_EMAIL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  REDIS_URL: process.env.REDIS_URL,
  REDIS_TOKEN: process.env.REDIS_TOKEN,
  OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  SSO_ENABLED: parseOptionalEnum(process.env.SSO_ENABLED, ["true", "false"]),
  SSO_ISSUER: process.env.SSO_ISSUER,
  SSO_CLIENT_ID: process.env.SSO_CLIENT_ID,
  SSO_CLIENT_SECRET: process.env.SSO_CLIENT_SECRET,
  SCIM_SHARED_SECRET: process.env.SCIM_SHARED_SECRET,
  MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY,
  TENANCY_MODE: parseOptionalEnum(process.env.TENANCY_MODE, ["single", "shared", "isolated"]),
  DEFAULT_TENANT_ID: process.env.DEFAULT_TENANT_ID,
  AI_GOVERNANCE_ENFORCED: parseOptionalEnum(process.env.AI_GOVERNANCE_ENFORCED, ["true", "false"]),
  AI_REQUIRE_AUTH: parseOptionalEnum(process.env.AI_REQUIRE_AUTH, ["true", "false"]),
  AI_ALLOWED_MODELS: process.env.AI_ALLOWED_MODELS,
  JOB_WORKER_BATCH_SIZE: process.env.JOB_WORKER_BATCH_SIZE,
  JOB_WORKER_POLL_INTERVAL_MS: process.env.JOB_WORKER_POLL_INTERVAL_MS,
  JOB_WORKER_MAX_ATTEMPTS: process.env.JOB_WORKER_MAX_ATTEMPTS,
  JOB_WORKER_RETRY_DELAY_MS: process.env.JOB_WORKER_RETRY_DELAY_MS,
  JOB_WORKER_LEASE_MS: process.env.JOB_WORKER_LEASE_MS,
  JOB_RETENTION_HOURS: process.env.JOB_RETENTION_HOURS,
  JOB_TENANT_ID: process.env.JOB_TENANT_ID,
  ENABLE_FEDERATED_LEARNING: parseOptionalEnum(process.env.ENABLE_FEDERATED_LEARNING, ["true", "false"]),
  ENABLE_CAUSAL_SIDECAR: parseOptionalEnum(process.env.ENABLE_CAUSAL_SIDECAR, ["true", "false"]),
  ENABLE_NEO4J_BACKEND: parseOptionalEnum(process.env.ENABLE_NEO4J_BACKEND, ["true", "false"]),
  ENABLE_SCREENING_SIDECAR: parseOptionalEnum(process.env.ENABLE_SCREENING_SIDECAR, ["true", "false"]),
  ENABLE_OPENMM_SIDECAR: parseOptionalEnum(process.env.ENABLE_OPENMM_SIDECAR, ["true", "false"]),
  ENABLE_FEP_SIDECAR: parseOptionalEnum(process.env.ENABLE_FEP_SIDECAR, ["true", "false"]),
  FEP_SIDECAR_URL: process.env.FEP_SIDECAR_URL,
}

export const env = parsedEnv.success ? parsedEnv.data : fallbackEnv