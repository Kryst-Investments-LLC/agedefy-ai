import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "__tests__/jwt-for-tests-integration.test.ts",
      "__tests__/mechanistic-models-api.test.ts",
      "__tests__/scientist-sponsor-marketplace-integration.test.ts",
    ],
    globals: true,
    globalSetup: ["./__tests__/global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
})
