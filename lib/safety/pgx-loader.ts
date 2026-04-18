/**
 * CPIC guideline loader.
 *
 * The in-tree CPIC table in `pgx.ts` is only meant for unit tests and
 * local dev. Production deployments should mount the CPIC release as a
 * JSON file and point `CPIC_GUIDELINES_JSON_PATH` at it.
 *
 * Expected file shape (a flattened, gene-drug-phenotype matrix derived
 * from the CPIC release JSON at https://cpicpgx.org/guidelines/):
 *
 *   {
 *     "version": "v2024.3",
 *     "source": "CPIC",
 *     "rows": [
 *       { "drug": "clopidogrel", "gene": "CYP2C19",
 *         "phenotype": "POOR", "level": "ALTERNATIVE_PREFERRED",
 *         "rationale": "..." },
 *       ...
 *     ]
 *   }
 *
 * Rows from the file shadow rows in the in-tree fallback when they
 * collide on (drug, gene, phenotype). If the file is missing or
 * malformed we fall back to the in-tree table — but log a warning so
 * the operator knows pharmacogenomic guidance is degraded.
 */

import { existsSync, readFileSync, statSync } from "node:fs"

import type { PgxMetabolizerPhenotype } from "@prisma/client"

import { env } from "@/lib/env"

import type { PgxRecommendationLevel } from "./pgx"

export interface CpicRow {
  drug: string
  gene: string
  phenotype: PgxMetabolizerPhenotype
  level: PgxRecommendationLevel
  rationale: string
}

export interface CpicTable {
  version: string
  source: string
  rows: CpicRow[]
}

interface CacheEntry {
  mtimeMs: number
  table: CpicTable
}

const cache = new Map<string, CacheEntry>()

const VALID_PHENOTYPES: ReadonlySet<PgxMetabolizerPhenotype> = new Set([
  "POOR",
  "INTERMEDIATE",
  "NORMAL",
  "RAPID",
  "ULTRARAPID",
  "INDETERMINATE",
])

const VALID_LEVELS: ReadonlySet<PgxRecommendationLevel> = new Set([
  "USE_AS_DIRECTED",
  "ADJUST_DOSE",
  "ALTERNATIVE_PREFERRED",
  "AVOID",
])

function isCpicRow(value: unknown): value is CpicRow {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  return (
    typeof r.drug === "string" &&
    typeof r.gene === "string" &&
    typeof r.phenotype === "string" &&
    VALID_PHENOTYPES.has(r.phenotype as PgxMetabolizerPhenotype) &&
    typeof r.level === "string" &&
    VALID_LEVELS.has(r.level as PgxRecommendationLevel) &&
    typeof r.rationale === "string"
  )
}

function parseCpicTable(raw: string): CpicTable {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object") {
    throw new Error("CPIC file is not a JSON object")
  }
  const obj = parsed as Record<string, unknown>
  const version = typeof obj.version === "string" ? obj.version : "unknown"
  const source = typeof obj.source === "string" ? obj.source : "CPIC"
  const rowsUnknown = obj.rows
  if (!Array.isArray(rowsUnknown)) {
    throw new Error("CPIC file is missing a `rows` array")
  }
  const rows: CpicRow[] = []
  for (const row of rowsUnknown) {
    if (!isCpicRow(row)) {
      throw new Error("CPIC file contains a malformed row")
    }
    rows.push({
      drug: row.drug.toLowerCase(),
      gene: row.gene.toUpperCase(),
      phenotype: row.phenotype,
      level: row.level,
      rationale: row.rationale,
    })
  }
  return { version, source, rows }
}

/**
 * Reads the configured CPIC release JSON if `CPIC_GUIDELINES_JSON_PATH`
 * is set and the file exists. Returns `null` otherwise — callers fall
 * back to the in-tree table. Result is cached by mtime so a single
 * release file is parsed once per process per release.
 */
export function loadCpicTable(): CpicTable | null {
  const path = env.CPIC_GUIDELINES_JSON_PATH
  if (!path) return null
  if (!existsSync(path)) {
    console.warn(`[pgx] CPIC_GUIDELINES_JSON_PATH=${path} not found; using in-tree table.`)
    return null
  }
  let mtimeMs: number
  try {
    mtimeMs = statSync(path).mtimeMs
  } catch (err) {
    console.warn(`[pgx] cannot stat CPIC file ${path}: ${(err as Error).message}`)
    return null
  }
  const cached = cache.get(path)
  if (cached && cached.mtimeMs === mtimeMs) return cached.table
  try {
    const raw = readFileSync(path, "utf8")
    const table = parseCpicTable(raw)
    cache.set(path, { mtimeMs, table })
    return table
  } catch (err) {
    console.warn(`[pgx] failed to parse CPIC file ${path}: ${(err as Error).message}`)
    return null
  }
}

/** Test hook. Not for production use. */
export function __resetCpicLoaderCacheForTests(): void {
  cache.clear()
}
