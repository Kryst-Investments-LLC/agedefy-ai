import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { ENV_SCHEMA_KEYS } from "@/lib/env"

/**
 * P0-CFG-002 documentation drift-guard.
 *
 * Every environment variable the runtime schema validates must be documented in
 * `.env.example` — either as an assigned `KEY=` line or a commented `# KEY=`
 * override example. This fails the build the moment a new validated variable is
 * added to lib/env.ts without a corresponding entry, so the operator-facing
 * configuration reference can't silently drift from what the app actually reads.
 */
describe("`.env.example` documents every validated environment variable (P0-CFG-002)", () => {
  const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8")

  // Keys documented in .env.example: `KEY=`, `# KEY=`, or `#KEY=` at line start.
  const documentedKeys = new Set(
    envExample
      .split(/\r?\n/)
      .map((line) => /^#?\s*([A-Z][A-Z0-9_]+)=/.exec(line)?.[1])
      .filter((key): key is string => Boolean(key)),
  )

  it("has at least one documented variable (sanity: the file parsed)", () => {
    expect(documentedKeys.size).toBeGreaterThan(20)
  })

  it("documents every key in the runtime env schema", () => {
    const undocumented = ENV_SCHEMA_KEYS.filter((key) => !documentedKeys.has(key))
    expect(
      undocumented,
      `These validated variables are missing from .env.example: ${undocumented.join(", ")}`,
    ).toEqual([])
  })
})
