# AGENTS.md — Biozephyra / agedefy

Universal AI-assistant context for this repo. Cursor, GitHub Copilot, Gemini CLI,
Windsurf, Aider, Zed, Warp, and Claude all read this file. Keep it accurate; it is
the single source of truth for how to work here.

> Domain-specific agent fleet + legal-jurisdiction tooling are documented separately
> in [`docs/AGENTS.md`](docs/AGENTS.md). This file is the engineering/stack standard.

## What this is

Biozephyra (package `agedefy-ai`) is a longevity **research & care** platform:
biomarker tracking, a curated compound knowledge graph, AI-assisted *informational*
coaching, telemedicine/lab workflows, a marketplace, and a research/discovery suite.
It is **not** a medical service and must never present itself as one.

## Stack

- **Next.js 16** (App Router, Turbopack) · React · TypeScript (`strict: false`)
- **Tailwind CSS** · shadcn/ui components in `components/ui`
- **Prisma 6 + PostgreSQL only** (no SQLite). Schema: `prisma/schema.prisma`
  (`provider = "postgresql"`). Migrations: a single squashed baseline
  `prisma/migrations/0_init`. Config: `prisma.config.ts`.
- **NextAuth** (credentials, `bcryptjs`). Request middleware lives in **`proxy.ts`**
  (Next 16 convention — *not* `middleware.ts`): nonce-based CSP + route protection.
- **Vitest** for tests (2000+). DB-touching tests run against real Postgres;
  pure/unit tests mock `@/lib/db`.
- **pnpm** package manager.
- Integrations: Stripe (billing), Anthropic/OpenAI/Grok (AI), telemedicine, lab
  testing, marketplace. Optional science **sidecars** (OpenMM, screening, causal,
  mechanistic) are feature-flagged OFF by default.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm db:generate          # prisma generate
pnpm db:deploy            # prisma migrate deploy  (applies 0_init to Postgres)
pnpm db:push              # direct schema sync (ephemeral/test DBs)
pnpm test:unit            # vitest (excludes the live-server integration tests)
pnpm test:integration     # live-server tests (spin up next dev)
pnpm build                # next build (type-checks ALL routes — the real gate)
pnpm dev                  # next dev
```

**Local dev / tests need real Postgres.** Minimum env:
`DATABASE_URL` + `POSTGRES_DATABASE_URL` (a `postgresql://…` URL),
`NEXTAUTH_SECRET` (≥32 chars), `MFA_ENCRYPTION_KEY` (≥32 chars),
`NEXTAUTH_URL` (**must match the actual dev port** or login redirects break),
`APP_ENV=test` for the suite. Set `PORT` to pin the dev port.

> `next.config.mjs` and `proxy.ts` changes are **not** hot-reloaded — restart `pnpm dev`.

## Conventions

- Reference files as `path:line`. Match surrounding code style.
- API routes: `getServerSession` + `requireAuthWithRole` from `@/lib/rbac`.
  `requireAuthWithRole` returns `NextResponse | AuthedSession` — guard with
  `if (x instanceof NextResponse) return x`, never `if (x) return x`.
- Next 16 dynamic routes: `ctx.params` is a `Promise` — `await ctx.params`.
- Pages use `<AppShell>` (the sidebar). Do **not** use the old top `<Navigation>`.
- Provenance: sign agent results with `signResultSafe` (field is `result`, not `payload`).
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
  Branch off `main`; don't commit/push unless asked.

## Hard constraints (safety & compliance — do not violate)

- **Not medical advice.** Never use "cure", "treatment", "therapy", or "dose" as a
  claim. Outputs are CANDIDATES / LEADS / HYPOTHESES with a validation disclaimer.
- **`lib/agents/discovery-agent.ts` is a FORBIDDEN PATH** — do not modify it or route
  into it.
- New agent endpoints must be gated behind **RESEARCHER / CLINICIAN** roles and not
  exposed to consumers.
- Cohort-level queries enforce **k-anonymity (≥50) + differential privacy**.
- Don't reintroduce the removed **dual SQLite/Postgres Prisma pipeline**
  (`prisma.postgres.config.ts`, `migrations-postgres/`, `build-postgres-prisma-schema.mjs`).
  This repo is Postgres-only.
- Don't commit secrets. The committed `MFA_ENCRYPTION_KEY` must be rotated before prod.

## Off-limits / generated — don't hand-edit

`node_modules/`, `.next/`, `.next-test/`, Prisma client output, `*.log`,
`prisma/dev.db`, anything matched by `.gitignore`.

## Layout

- `app/` — App Router routes (`app/api/**` route handlers)
- `components/` — UI; `components/three/` 3D (Three.js); `components/discovery/` 3Dmol
- `lib/` — domain logic (agents, privacy/dp-engine, researcher cohort DSL, sidecars…)
- `agents/` — 41 platform agent YAMLs + `agents/legal-rules/` jurisdiction rules
- `prisma/` — schema + single migration baseline
- `__tests__/` — Vitest suites
- `scripts/` — one-off codemods / generators
