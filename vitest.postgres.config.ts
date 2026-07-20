import path from "node:path"
import { defineConfig } from "vitest/config"

export const postgresTestFiles = [
  "__tests__/audit-chain-integrity-pg.test.ts",
  "__tests__/consent-flow-pg.test.ts",
  "__tests__/account-erasure-pg.test.ts",
  "__tests__/ai-credits.test.ts",
  "__tests__/ai-provider-orchestration-routes.test.ts",
  "__tests__/canonical-health-event-routes.test.ts",
  "__tests__/circuit-breaker.test.ts",
  "__tests__/idempotency.test.ts",
  "__tests__/moat-db-integration.test.ts",
  "__tests__/orchestration-queue.test.ts",
  "__tests__/outbox-dispatcher.test.ts",
  "__tests__/prisma-health-event-store.test.ts",
  "__tests__/tenancy.test.ts",
  "__tests__/transactional-health-event-ingestion-service.test.ts",
]

export default defineConfig({
  test: {
    environment: "node",
    include: postgresTestFiles,
    globals: true,
    globalSetup: ["./__tests__/postgres-global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
})
