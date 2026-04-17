import "dotenv/config"

import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "node_modules/.cache/prisma/outbox/schema.prisma",
  migrations: {
    path: "prisma/migrations-outbox",
  },
  datasource: {
    url: process.env.OUTBOX_DATABASE_URL ?? process.env.POSTGRES_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
    shadowDatabaseUrl: process.env.OUTBOX_SHADOW_DATABASE_URL ?? process.env.POSTGRES_SHADOW_DATABASE_URL,
  },
} as any)