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
