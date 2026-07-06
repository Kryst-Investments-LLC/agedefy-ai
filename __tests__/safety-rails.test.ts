import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, type Dirent } from "node:fs"
import { join, resolve } from "node:path"

/**
 * Safety-rail CI guard.
 *
 * These tests inspect the source itself and FAIL THE BUILD if any of the four
 * hard rails that keep the self-improving health loop on the safe side of the
 * medical-advice line is removed. They are deliberately blunt source-string
 * assertions — the point is that a future edit which loosens a rail can't merge
 * silently; it has to consciously change this test too.
 *
 * The rails:
 *   1. Dosage suggestions are CLINICIAN-gated and never autonomous.
 *   2. The PLAN agent is researcher/clinician-gated, never consumer.
 *   3. The loop only DRAFTS protocol changes — it never auto-applies them.
 *   4. The forbidden discovery-agent (biomarker-profile → compound suggestion)
 *      is never imported by production code.
 */

const root = process.cwd()
const read = (p: string) => readFileSync(resolve(root, p), "utf8")

function walk(dir: string, acc: string[] = []): string[] {
  // `Dirent[]` (i.e. Dirent<string>) is what `withFileTypes: true` returns;
  // `ReturnType<typeof readdirSync>` mis-resolves to the Dirent<Buffer> overload.
  let entries: Dirent[]
  try {
    entries = readdirSync(resolve(root, dir), { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    const rel = join(dir, e.name)
    if (e.isDirectory()) {
      if (["node_modules", ".next", ".next-test", ".git", "__tests__"].includes(e.name)) continue
      walk(rel, acc)
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      acc.push(rel)
    }
  }
  return acc
}

describe("safety rails (CI guard — must never regress)", () => {
  it("Rail 1: dosage route is CLINICIAN-gated, never exposed to consumers", () => {
    const route = read("app/api/agents/dosage/route.ts")
    expect(route).toMatch(/requireAuthWithRole\(\s*session\s*,\s*"CLINICIAN"/)
    expect(route).not.toMatch(/"MEMBER"/)
  })

  it("Rail 1: dosage optimizer is always requiresClinician: true (never autonomous)", () => {
    const opt = read("lib/agents/dosage-optimizer.ts")
    expect(opt).toMatch(/requiresClinician:\s*true/)
    expect(opt).not.toMatch(/requiresClinician:\s*false/)
  })

  it("Rail 2: PLAN agent is researcher/clinician-gated, never consumer", () => {
    const route = read("app/api/agents/plan/route.ts")
    expect(route).toMatch(/requireAuthWithRole\([^)]*"RESEARCHER"/)
    expect(route).not.toMatch(/"MEMBER"/)
  })

  it("Rail 3: the loop drafts protocol changes (DRAFT) and never auto-applies them", () => {
    const agent = read("lib/agents/protocol-agent.ts")
    expect(agent).toMatch(/status:\s*['"]DRAFT['"]/)
    // The agent must never set APPLIED itself — applying requires a separate,
    // human-approved route. (DRAFT -> PENDING_APPROVAL -> APPROVED -> APPLIED)
    expect(agent).not.toMatch(/status:\s*['"]APPLIED['"]/)
  })

  it("Rail 4: the forbidden discovery-agent is not imported by any production code", () => {
    const files = [...walk("app"), ...walk("lib")]
    const importsForbidden = (src: string) =>
      /from\s+["'][^"']*agents\/discovery-agent["']/.test(src) ||
      /import\s*\(\s*["'][^"']*agents\/discovery-agent["']/.test(src)

    const offenders = files.filter(
      (f) => !f.endsWith("discovery-agent.ts") && importsForbidden(read(f)),
    )
    expect(offenders).toEqual([])
  })
})
