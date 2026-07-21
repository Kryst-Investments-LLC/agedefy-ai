---
name: debug-agedefy
description: Debugging playbook for agedefy - reproduce first, check the known-traps list, root-cause before fixing, prove the fix against the real build. Use when investigating a bug, failing test, or unexpected behavior.
---

# Debugging playbook — agedefy

## 1. Check the known traps FIRST (most "bugs" here are these)
- Login redirect to wrong app → `NEXTAUTH_URL` doesn't match the dev port.
- External fetch blocked (pubchem, rcsb, 3D viewers) → CSP in `proxy.ts` +
  `next.config.mjs` must allow the host.
- Config change "not taking effect" → `next.config.mjs`/`proxy.ts` are not
  hot-reloaded; restart `pnpm dev`.
- Weird build/dev corruption → `next build` and `next dev` share `.next`;
  never run both at once.
- Auth returning odd values → `requireAuthWithRole` result guarded with
  truthiness instead of `instanceof NextResponse`.
- Dynamic route params undefined → missing `await ctx.params` (Next 16).

## 2. Reproduce before touching anything
- Failing test: `pnpm vitest run <path>` with the Stage-0 env from
  verify-agedefy (real Postgres for DB tests).
- Runtime bug: `pnpm dev` and hit the route yourself.
- Can't reproduce = you don't understand it yet; gather evidence, don't "fix".

## 3. Root cause, not symptom
- Trace the real path (route → rbac → lib → Prisma) by reading code; don't
  guess from the error message. Trust code, not mocks — a green mocked test
  proves nothing about Postgres reality.
- `git log --oneline -10 -- <path>` — recent change is the usual culprit.

## 4. Prove the fix
- Re-run the exact reproduction, then `pnpm test:unit`, then `pnpm build`
  (the real gate). Intermittent bug: 5 clean runs minimum before "fixed".
- Never touch `lib/agents/discovery-agent.ts`, even to "fix" it — forbidden path.

## 5. Report
Root cause (one sentence), fix, evidence (commands + output). Symptom-only
mitigation must be labeled as such.
