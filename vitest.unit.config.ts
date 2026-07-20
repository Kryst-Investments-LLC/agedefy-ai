/**
 * Vitest config for unit tests that fully mock the database and external
 * services. No global server setup is required — all integration concerns
 * are handled via vi.mock() inside each test file.
 *
 * Usage: npx vitest run --config vitest.unit.config.ts
 * Or via package.json: pnpm test:unit-only
 *
 * Integration tests that need a live DB + Next.js server still use
 * vitest.config.ts (the default) via `pnpm test`.
 */

import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      // Integration tests that require a live DB + server:
      '__tests__/jwt-for-tests-integration.test.ts',
      '__tests__/mechanistic-models-api.test.ts',
      '__tests__/scientist-sponsor-marketplace-integration.test.ts',
      // PostgreSQL integration tests (real Prisma client or DB-backed route dependencies):
      '__tests__/audit-chain-integrity-pg.test.ts',
      '__tests__/ai-credits.test.ts',
      '__tests__/ai-provider-orchestration-routes.test.ts',
      '__tests__/canonical-health-event-routes.test.ts',
      '__tests__/circuit-breaker.test.ts',
      '__tests__/idempotency.test.ts',
      '__tests__/moat-db-integration.test.ts',
      '__tests__/orchestration-queue.test.ts',
      '__tests__/outbox-dispatcher.test.ts',
      '__tests__/prisma-health-event-store.test.ts',
      '__tests__/tenancy.test.ts',
      '__tests__/transactional-health-event-ingestion-service.test.ts',
    ],
    globals: true,
    // No globalSetup — unit tests mock all I/O.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
