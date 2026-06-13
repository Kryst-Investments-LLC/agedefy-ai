/**
 * ⚠ TODO: THIS LOADER IS NOT ACTIVE — `@longevity-standards/legal-rules` IS NOT INSTALLED
 * ────────────────────────────────────────────────────────────────────────────────────────
 * The package import in `loadJurisdictionRuleSet` will always throw, triggering the
 * catch-block fallback that returns an empty rule set. Every gate evaluation will
 * therefore default-ALLOW with no enforcement applied.
 *
 * This file is inert scaffolding. Do not cite it as evidence of active legal/regulatory
 * enforcement in any user-facing copy, documentation, or sales material.
 * ────────────────────────────────────────────────────────────────────────────────────────
 *
 * Adapter that converts the rich rule packs published by
 * `@longevity-standards/legal-rules` into the simpler `JurisdictionRuleSet`
 * shape consumed by `lib/legal/jurisdiction-gate.ts`.
 *
 * Mapping:
 *   - severity `critical` | `high`  -> BLOCK
 *   - severity `medium`             -> REDACT
 *   - severity `low` | unset        -> ALLOW
 *
 * Each `rule.category` becomes the `topic` key the gate matches on.
 *
 * The package may be unavailable (e.g. dev environments without the git
 * dependency installed); in that case `loadJurisdictionRuleSet` returns
 * an empty rule set and logs a single warning so the gate falls back to
 * its default-ALLOW behaviour.
 */

import type { GateDecision, JurisdictionRule, JurisdictionRuleSet } from "./jurisdiction-gate"

type RawRule = {
  id: string
  description?: string
  severity?: "critical" | "high" | "medium" | "low"
  category?: string
  citations?: { title?: string; url?: string }[]
}

type RawPack = {
  jurisdiction: { code: string; name?: string; region?: string }
  last_reviewed?: string
  rules: RawRule[]
}

function severityToDecision(sev?: RawRule["severity"]): GateDecision {
  switch (sev) {
    case "critical":
    case "high":
      return "BLOCK"
    case "medium":
      return "REDACT"
    default:
      return "ALLOW"
  }
}

function citationToReason(rule: RawRule): string {
  const desc = (rule.description || "").trim().split("\n")[0]?.trim() || rule.id
  const cite = rule.citations?.[0]?.title || rule.citations?.[0]?.url
  return cite ? `${desc} [${cite}]` : desc
}

function packToRules(pack: RawPack): JurisdictionRule[] {
  const code = pack.jurisdiction.code.toUpperCase()
  const region = pack.jurisdiction.region ? `${code}-${pack.jurisdiction.region.toUpperCase()}` : code
  return pack.rules
    .filter((r) => !!r.category)
    .map((r) => ({
      jurisdiction: region,
      topic: r.category as string,
      decision: severityToDecision(r.severity),
      reason: citationToReason(r),
    }))
}

let cached: JurisdictionRuleSet | null = null
let warned = false

export async function loadJurisdictionRuleSet(): Promise<JurisdictionRuleSet> {
  if (cached) return cached
  try {
    const mod = await import("@longevity-standards/legal-rules")
    const packs = (await mod.loadAll()) as Record<string, RawPack>
    const rules = Object.values(packs).flatMap(packToRules)
    const versionParts = Object.values(packs)
      .map((p) => p.last_reviewed)
      .filter(Boolean)
      .sort()
    cached = {
      version: `legal-rules@${versionParts[versionParts.length - 1] ?? "unknown"}`,
      rules,
    }
    return cached
  } catch (err) {
    if (!warned) {
      warned = true
      // eslint-disable-next-line no-console
      console.warn(
        `[legal-rules] @longevity-standards/legal-rules not available; falling back to empty rule set: ${
          (err as Error).message
        }`,
      )
    }
    cached = { version: "legal-rules@unavailable", rules: [] }
    return cached
  }
}

/** Test-only: drop the cached rule set so the next call re-reads the package. */
export function _resetForTests(): void {
  cached = null
  warned = false
}
