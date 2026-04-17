import "dotenv/config"

import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "node_modules/.cache/prisma/postgres/schema.prisma",
  migrations: {
    path: "prisma/migrations-postgres",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.POSTGRES_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
    shadowDatabaseUrl: process.env.POSTGRES_SHADOW_DATABASE_URL,
  },
} as any)