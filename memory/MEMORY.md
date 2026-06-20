# MEMORY.md

Committed, shared project memory. One line per fact below; keep full detail in a
per-fact file under `memory/`. At the end of a productive session, say *"update your
memory files with what you learned about the codebase today."* Record only the
**non-obvious** — gotchas, decisions, and constraints the code/git history doesn't
already make clear. Don't store secrets or personal prefs (those go in the gitignored
`CLAUDE.local.md`).

## Index

- **Postgres-only** — the dual SQLite/Postgres Prisma pipeline was collapsed; there is
  one squashed baseline `prisma/migrations/0_init` and no `prisma.postgres.config.ts`.
  Local dev/tests require a real `postgresql://` DATABASE_URL. `db:push` for ephemeral
  test DBs; `db:deploy` for the real migration path.
- **Mocked tests hide real bugs** — unit tests mock `@/lib/db`, so schema mismatches
  (wrong table/column names, wrong signer field) pass tests but break the build/runtime.
  Verify with `next build` + DB-backed tests against real Postgres.
- **Middleware is `proxy.ts`** (Next 16), not `middleware.ts`. It sets the nonce CSP +
  route protection. CSP `connect-src` must list every external fetch host (Stripe,
  NCBI eutils, **pubchem**, **files.rcsb.org**, clinicaltrials).
- **Auth guard** — `requireAuthWithRole` returns `NextResponse | AuthedSession`; guard
  with `instanceof NextResponse`. `NEXTAUTH_URL` must match the running dev port or
  post-login redirects land on the wrong local app.
- **Two repos existed** — the canonical codebase is `AI-Platforms/agedefy`
  (remote `agedefy-AI`); an older `your-workspace-folder/agedefy-ai` had the AI-tooling
  scaffold but no unique code. Consolidating onto this one.
- **Hard constraints** — not medical advice; `lib/agents/discovery-agent.ts` is a
  forbidden path; RESEARCHER/CLINICIAN gating; k-anon ≥50 + DP on cohort queries;
  W3C VC provenance on agent results.
