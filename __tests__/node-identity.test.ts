import { describe, it, expect } from "vitest"

import {
  canonicalNodeIdentity,
  NODE_IDENTITY_PREFIX,
  NODE_IDENTITY_VERSION,
  type NodeIdentityInput,
} from "@/lib/knowledge-graph/node-identity"

function base(overrides: Partial<NodeIdentityInput> = {}): NodeIdentityInput {
  return {
    tenantId: "default",
    kind: "compound",
    canonicalName: "Rapamycin",
    externalIds: { cas: "53123-88-9", pubchem: "5284616" },
    attributes: { category: "small-molecule" },
    ...overrides,
  }
}

describe("canonicalNodeIdentity — format", () => {
  it("returns a versioned, prefixed sha256 identity", () => {
    const id = canonicalNodeIdentity(base())
    expect(id.startsWith(NODE_IDENTITY_PREFIX)).toBe(true)
    expect(id).toBe(`bzkg${NODE_IDENTITY_VERSION}:` + id.slice(NODE_IDENTITY_PREFIX.length))
    // sha256 hex is 64 chars
    expect(id.slice(NODE_IDENTITY_PREFIX.length)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe("canonicalNodeIdentity — determinism", () => {
  it("is stable across calls for identical input", () => {
    expect(canonicalNodeIdentity(base())).toBe(canonicalNodeIdentity(base()))
  })

  it("is independent of externalIds key order", () => {
    const a = canonicalNodeIdentity(base({ externalIds: { cas: "53123-88-9", pubchem: "5284616" } }))
    const b = canonicalNodeIdentity(base({ externalIds: { pubchem: "5284616", cas: "53123-88-9" } }))
    expect(a).toBe(b)
  })

  it("is independent of attributes key order", () => {
    const a = canonicalNodeIdentity(base({ attributes: { x: 1, y: 2 } }))
    const b = canonicalNodeIdentity(base({ attributes: { y: 2, x: 1 } }))
    expect(a).toBe(b)
  })

  it("normalises name case and whitespace", () => {
    const a = canonicalNodeIdentity(base({ canonicalName: "Rapamycin" }))
    const b = canonicalNodeIdentity(base({ canonicalName: "  rapamycin  " }))
    const c = canonicalNodeIdentity(base({ canonicalName: "RAPA\tMYCIN".replace("\t", "   ") }))
    expect(a).toBe(b)
    expect(c).not.toBe(a) // different token, sanity that normalisation isn't over-eager
  })

  it("ignores empty/nullish external id values", () => {
    const a = canonicalNodeIdentity(base({ externalIds: { cas: "53123-88-9", pubchem: "5284616" } }))
    const b = canonicalNodeIdentity(
      base({ externalIds: { cas: "53123-88-9", pubchem: "5284616", chembl: "", inchikey: null } }),
    )
    expect(a).toBe(b)
  })
})

describe("canonicalNodeIdentity — separation", () => {
  it("differs across tenants", () => {
    expect(canonicalNodeIdentity(base({ tenantId: "t1" }))).not.toBe(
      canonicalNodeIdentity(base({ tenantId: "t2" })),
    )
  })

  it("differs across node kinds", () => {
    expect(canonicalNodeIdentity(base({ kind: "compound" }))).not.toBe(
      canonicalNodeIdentity(base({ kind: "biomarker" })),
    )
  })

  it("differs when an external id changes", () => {
    expect(canonicalNodeIdentity(base({ externalIds: { cas: "53123-88-9" } }))).not.toBe(
      canonicalNodeIdentity(base({ externalIds: { cas: "000-00-0" } })),
    )
  })

  it("differs when an external id is added (extensibility)", () => {
    const without = canonicalNodeIdentity(base({ externalIds: { cas: "53123-88-9" } }))
    const withChembl = canonicalNodeIdentity(base({ externalIds: { cas: "53123-88-9", chembl: "CHEMBL413" } }))
    expect(without).not.toBe(withChembl)
  })

  it("differs across names", () => {
    expect(canonicalNodeIdentity(base({ canonicalName: "rapamycin" }))).not.toBe(
      canonicalNodeIdentity(base({ canonicalName: "metformin" })),
    )
  })
})

describe("canonicalNodeIdentity — defaults", () => {
  it("works with no externalIds or attributes", () => {
    const id = canonicalNodeIdentity({ tenantId: "default", kind: "biomarker", canonicalName: "hs-CRP" })
    expect(id.startsWith(NODE_IDENTITY_PREFIX)).toBe(true)
  })

  it("treats missing attributes the same as empty object", () => {
    const a = canonicalNodeIdentity({ tenantId: "default", kind: "biomarker", canonicalName: "hs-CRP" })
    const b = canonicalNodeIdentity({ tenantId: "default", kind: "biomarker", canonicalName: "hs-CRP", attributes: {} })
    expect(a).toBe(b)
  })
})
