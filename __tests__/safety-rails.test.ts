import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, type Dirent } from "node:fs"
import { join, resolve } from "node:path"

import { LIFECYCLE, nextAllowedStatus } from "@/lib/validators/experiment"

/**
 * Safety-rail CI guard.
 *
 * These tests inspect the source itself and FAIL THE BUILD if any of the hard
 * rails that keep the self-improving health loop on the safe side of the
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
 *   5. A generated candidate never AUTOMATICALLY becomes a protocol, product,
 *      listing, or purchasable item (P0-CMP-004).
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
    // Match ANY import whose path ends in discovery-agent — absolute
    // (@/lib/agents/discovery-agent) OR relative (./discovery-agent). The
    // previous pattern only matched paths containing "agents/", so a relative
    // import from within lib/agents slipped past the guard.
    const importsForbidden = (src: string) =>
      /from\s+["'][^"']*discovery-agent["']/.test(src) ||
      /import\s*\(\s*["'][^"']*discovery-agent["']/.test(src)

    const offenders = files.filter(
      (f) => !f.endsWith("discovery-agent.ts") && importsForbidden(read(f)),
    )
    expect(offenders).toEqual([])
  })

  it("Rail 5: the experiment-candidate lifecycle is research-only (no promotion status)", () => {
    // The lifecycle contains ONLY research states. There is deliberately no
    // status that turns a model-generated candidate into a protocol,
    // recommendation, product, listing, advertisement, or purchasable item.
    // Adding such a status must fail this rail and force a conscious review.
    expect(LIFECYCLE).toEqual(["PROPOSED", "SCREENED", "SENT_TO_LAB", "RESULT_LOGGED", "FED_BACK"])
    // The terminal research state cannot auto-advance anywhere.
    expect(nextAllowedStatus("FED_BACK")).toBeNull()
  })

  it("Rail 5: protocol creation is user-authored, never auto-built from a candidate", () => {
    // A candidate never automatically becomes a protocol — the protocol create
    // route must not ingest an experiment candidate.
    const src = read("app/api/protocols/route.ts")
    expect(src).not.toMatch(/candidateId|experimentCandidate/i)
  })

  it("Rail 5: candidate validation-listing is explicit + owner-gated (not automatic)", () => {
    // Listing a candidate for lab validation must be an explicit, owner-initiated
    // action on a specific research status — never an automatic promotion.
    const src = read("app/api/scientist-sponsor-marketplace/validation-listings/route.ts")
    expect(src).toMatch(/userId:\s*session\.user\.id/) // ownership check
    expect(src).toMatch(/candidate\.status/) // explicit research-status gate
  })
})
