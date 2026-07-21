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

// Single source of truth for the PostgreSQL-backed tests so this exclude list
// can never drift from vitest.postgres.config.ts (a new *-pg test added there is
// automatically excluded here — otherwise it silently runs under `test:unit`
// without a DB and only "passes" when DATABASE_URL happens to be set).
import { postgresTestFiles } from './vitest.postgres.config'

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
      // PostgreSQL integration tests (real Prisma client / DB-backed routes):
      ...postgresTestFiles,
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
