import "dotenv/config"

import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Postgres-only. DATABASE_URL is set in every real environment (dev, CI,
    // staging, prod); the placeholder only satisfies `prisma generate`, which
    // does not connect. There is no SQLite fallback by design.
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/postgres",
  },
} as any)