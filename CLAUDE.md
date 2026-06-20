# CLAUDE.md

Project guidance for Claude (Claude Code & claude.ai). Read [`AGENTS.md`](AGENTS.md)
first — it holds the full stack, commands, conventions, and hard constraints. This
file adds Claude-specific working notes.

## Working style for this repo

- **The build is the real gate.** `pnpm build` type-checks every route; `tsc --noEmit`
  and green Vitest are necessary but not sufficient. Mocked unit tests have hidden
  real bugs here before (e.g., a query against a non-existent `biomarkerRecord`
  table, `payload` vs `result` on the signer) — verify against **real Postgres** and
  a real build, not just mocks.
- **Verify, don't assume.** Stand up a throwaway Postgres, run `db:deploy`, run the
  suite, and run `next build` before claiming something works. Report failures with
  output.
- **Don't fight the dev server.** `next build` and `next dev` share `.next`; don't run
  a build while a dev server is up. `next.config.mjs`/`proxy.ts` changes need a dev
  restart (they aren't hot-reloaded).
- Confirm before irreversible / outward-facing actions (deletes, pushes, deploys).

## Memory

This repo uses a committed memory index at [`memory/MEMORY.md`](memory/MEMORY.md).
At the end of a productive session, say: *"update your memory files with what you
learned about the codebase today."* Write one fact per file under `memory/` and add a
one-line pointer to `memory/MEMORY.md`. Don't record what the code/git history already
shows — capture the non-obvious (gotchas, decisions, constraints).

Personal/local preferences go in `CLAUDE.local.md` (gitignored — never committed).

## Easy traps in this codebase (learned the hard way)

- `requireAuthWithRole` returns `NextResponse | AuthedSession` → guard with
  `instanceof NextResponse`.
- Next 16: `await ctx.params` in dynamic routes; pages use `<AppShell>`, not `<Navigation>`.
- Postgres-only: never reintroduce the dual Prisma pipeline.
- `NEXTAUTH_URL` must match the running dev port or post-login redirects go to the
  wrong app.
- CSP (`proxy.ts` + `next.config.mjs`) must allow any external fetch host
  (e.g. pubchem, rcsb for the 3D viewers).
- `lib/agents/discovery-agent.ts` is a forbidden path. No medical claims, ever.
