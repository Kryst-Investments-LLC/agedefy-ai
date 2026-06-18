/**
 * Canonical Knowledge-Graph Node Identity
 *
 * Produces a deterministic, replayable, tenant-safe identity string for a
 * KgNode from its stable attributes — used as `KgNode.externalId` when a node
 * is materialised from internal data (e.g. the outcomes flywheel) rather than
 * imported with a clean external ontology ID.
 *
 * Identity = versioned prefix + sha256 over a canonical serialisation of:
 *   tenantId · kind · canonicalName · sortedExternalIds · sortedAttributesJson
 *
 * Properties:
 *   - Deterministic   — same logical node → same id, regardless of field order
 *   - Replayable      — graph can be rebuilt from source at any time
 *   - Portable        — not tied to DB primary keys
 *   - Extensible      — external IDs (CAS, PubChem, ChEMBL, InChIKey…) fold in
 *   - Tenant-safe     — tenantId is part of the identity
 *   - Versioned       — schema version is embedded in the prefix
 *
 * Pure module — no DB, no I/O.
 *
 * @module lib/knowledge-graph/node-identity
 */

import { createHash } from "node:crypto"

/** Identity schema version. Bump when the canonicalisation rules change. */
export const NODE_IDENTITY_VERSION = 1

/** Prefix stamped on every generated identity, e.g. "bzkg1:". */
export const NODE_IDENTITY_PREFIX = `bzkg${NODE_IDENTITY_VERSION}:`

export interface NodeIdentityInput {
  /** Tenant scope — different tenants never share node identities. */
  tenantId: string
  /** Node kind, e.g. "compound", "biomarker", "protocol". */
  kind: string
  /** Human label for the node; normalised before hashing. */
  canonicalName: string
  /**
   * Known external identifiers, keyed by namespace (e.g. { cas, pubchem,
   * chembl, inchikey }). Empty/nullish values are dropped; order-independent.
   */
  externalIds?: Record<string, string | number | null | undefined>
  /** Additional stable attributes folded into the identity; order-independent. */
  attributes?: Record<string, unknown>
}

/** Normalise a free-text name: lowercase, trim, collapse internal whitespace. */
function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Deterministically serialise an arbitrary JSON-like value with object keys
 * sorted recursively, so logically-equal inputs serialise identically.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`
}

/** Normalise external IDs into a sorted, deterministic "ns=value" list. */
function canonicalExternalIds(
  externalIds: Record<string, string | number | null | undefined> | undefined,
): string {
  if (!externalIds) return ""
  const pairs: string[] = []
  for (const [ns, raw] of Object.entries(externalIds)) {
    if (raw === null || raw === undefined) continue
    const val = String(raw).trim()
    if (val === "") continue
    pairs.push(`${ns.trim().toLowerCase()}=${val.toLowerCase()}`)
  }
  return pairs.sort().join("|")
}

/**
 * Compute the canonical identity string for a node.
 *
 * Returns `${NODE_IDENTITY_PREFIX}<sha256hex>`.
 */
export function canonicalNodeIdentity(input: NodeIdentityInput): string {
  const parts = [
    `v=${NODE_IDENTITY_VERSION}`,
    `tenant=${input.tenantId.trim()}`,
    `kind=${input.kind.trim().toLowerCase()}`,
    `name=${normaliseName(input.canonicalName)}`,
    `ext=${canonicalExternalIds(input.externalIds)}`,
    `attr=${canonicalJson(input.attributes ?? {})}`,
  ]
  const digest = createHash("sha256").update(parts.join("\n")).digest("hex")
  return `${NODE_IDENTITY_PREFIX}${digest}`
}
