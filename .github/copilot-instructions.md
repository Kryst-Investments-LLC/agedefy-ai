# GitHub Copilot instructions — Biozephyra / agedefy

Full context is in [`AGENTS.md`](../AGENTS.md). Summary for inline suggestions:

## Stack
Next.js 16 (App Router, Turbopack) · TypeScript (`strict: false`) · Tailwind +
shadcn/ui · Prisma 6 + **PostgreSQL only** · NextAuth (credentials, bcryptjs) ·
Vitest · pnpm. Request middleware is **`proxy.ts`** (not `middleware.ts`).

## Do
- API routes: `getServerSession` + `requireAuthWithRole(session, "RESEARCHER", …)`
  from `@/lib/rbac`; guard the result with `if (x instanceof NextResponse) return x`.
- Dynamic routes (Next 16): `const { id } = await ctx.params`.
- Pages render inside `<AppShell>` (the sidebar).
- Sign agent results with `signResultSafe({ resultType, result, … })` (field is
  `result`).
- Mock `@/lib/db` in unit tests; use real Postgres for DB-touching tests.

## Don't
- Don't make medical claims ("cure", "treatment", "therapy", "dose"). Outputs are
  hypotheses/candidates with a "not medical advice" disclaimer.
- Don't edit or route into `lib/agents/discovery-agent.ts` (forbidden path).
- Don't reintroduce the SQLite/dual Prisma pipeline (`prisma.postgres.config.ts`,
  `migrations-postgres/`). Postgres-only; single baseline `prisma/migrations/0_init`.
- Don't use the old top `<Navigation>` bar; don't commit secrets.

## Verify
`pnpm build` (type-checks all routes) + `pnpm test:unit` against real Postgres.
