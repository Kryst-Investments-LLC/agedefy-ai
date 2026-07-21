---
name: verify-agedefy
description: End-to-end verification for agedefy - unit tests, then the real gate (pnpm build), with real Postgres for DB-touching changes. Use before claiming any nontrivial change works.
---

# Verify agedefy

**The build is the real gate.** `tsc --noEmit` and green Vitest are necessary
but not sufficient — mocked unit tests have hidden real bugs here before
(query against non-existent table, `payload` vs `result`). Run stages in
order; stop at first FAIL and report output verbatim.

## Stage 0 — env preconditions (DB-touching changes)
Real Postgres required. Minimum env: `DATABASE_URL` + `POSTGRES_DATABASE_URL`,
`NEXTAUTH_SECRET` (≥32 chars), `MFA_ENCRYPTION_KEY` (≥32 chars),
`NEXTAUTH_URL` matching the dev port, `APP_ENV=test`.
Then: `pnpm db:generate && pnpm db:deploy` (or `db:push` on a throwaway DB).

## Stage 1 — unit suite
```
pnpm test:unit
```

## Stage 2 — the real gate
```
pnpm build
```
Type-checks every route. Never run while a dev server is up (shared `.next`).

## Stage 3 — integration (server-behavior changes: routes, auth, proxy.ts, CSP)
```
pnpm test:integration
```
Spins up `next dev`. Remember `next.config.mjs`/`proxy.ts` are not hot-reloaded.

## Report
| Stage | Command | Result |
|---|---|---|
| unit | pnpm test:unit | PASS/FAIL (N/M) |
| build (real gate) | pnpm build | PASS/FAIL |
| integration | pnpm test:integration | PASS/FAIL/SKIPPED (why) |

SKIPPED needs a stated reason. FAIL anywhere = not done.
