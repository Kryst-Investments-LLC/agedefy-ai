/**
 * Loads the versioned in-repository legal rule packs into the runtime gate.
 * These rules are technical controls and still require qualified legal review;
 * their presence must not be represented as a legal-compliance certification.
 *
 * Mapping:
 *   - severity `critical` | `high`  -> BLOCK
 *   - severity `medium`             -> REDACT
 *   - severity `low` | unset        -> ALLOW
 *
 * Each `rule.category` becomes the `topic` key the gate matches on.
 *
 */

import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { parse } from "yaml"

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

async function listRuleFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) return listRuleFiles(absolute)
      return /\.ya?ml$/i.test(entry.name) ? [absolute] : []
    }),
  )
  return nested.flat().sort()
}

async function loadRepositoryPacks(): Promise<RawPack[]> {
  const root = path.join(process.cwd(), "agents", "legal-rules")
  const files = await listRuleFiles(root)
  return Promise.all(
    files.map(async (file) => {
      const pack = parse(await readFile(file, "utf8")) as RawPack
      if (!pack?.jurisdiction?.code || !Array.isArray(pack.rules)) {
        throw new Error(`Invalid legal rule pack: ${path.relative(process.cwd(), file)}`)
      }
      return pack
    }),
  )
}

export async function loadJurisdictionRuleSet(): Promise<JurisdictionRuleSet> {
  if (cached) return cached
  try {
    const packs = await loadRepositoryPacks()
    const rules = packs.flatMap(packToRules)
    const versionParts = packs
      .map((p) => p.last_reviewed)
      .filter(Boolean)
      .sort()
    cached = {
      version: `repository-legal-rules@${versionParts[versionParts.length - 1] ?? "unknown"}`,
      rules,
    }
    return cached
  } catch (err) {
    if (!warned) {
      warned = true
      console.warn(
        `[legal-rules] repository rule packs unavailable: ${
          (err as Error).message
        }`,
      )
    }
    if (["staging", "production"].includes(process.env.APP_ENV ?? "")) {
      throw new Error("Legal rule packs are required in staging and production", { cause: err })
    }
    cached = { version: "repository-legal-rules@unavailable", rules: [] }
    return cached
  }
}

/** Test-only: drop the cached rule set so the next call re-reads the package. */
export function _resetForTests(): void {
  cached = null
  warned = false
}
