import { describe, it, expect } from "vitest"
import { KgEdgeType, KgEvidenceGrade } from "@prisma/client"

import {
  biomarkerFromBucket,
  deriveRweEdge,
  deriveRweEvidenceGrade,
  planRweMaterialization,
  RWE_SOURCE,
  RWE_MIN_SAMPLE_SIZE,
  RWE_CLOW_SAMPLE_SIZE,
  type AggregateOutcomeRow,
  type CompoundIdentity,
  type PopulationEffect,
} from "@/lib/flywheel/causal-edge-materializer"
import { NODE_IDENTITY_PREFIX } from "@/lib/knowledge-graph/node-identity"

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeEffect(overrides: Partial<PopulationEffect> = {}): PopulationEffect {
  return {
    subjectKind: "compound",
    subjectExternalId: "CHEMBL413",
    subjectLabel: "Rapamycin",
    objectKind: "biomarker",
    objectExternalId: "hs_crp",
    objectLabel: "hs-CRP",
    sampleSize: 120,
    effectSize: -0.18,
    effectSizeUnit: "z-score",
    stdDev: 0.4,
    pValue: 0.01,
    confidence: 0.7,
    period: "2026-Q2",
    ...overrides,
  }
}

// ── Suppression floor ─────────────────────────────────────────────────────────

describe("deriveRweEdge — publish floor", () => {
  it(`suppresses (null) when sampleSize < ${RWE_MIN_SAMPLE_SIZE}`, () => {
    expect(deriveRweEdge(makeEffect({ sampleSize: RWE_MIN_SAMPLE_SIZE - 1 }))).toBeNull()
  })

  it(`publishes when sampleSize == ${RWE_MIN_SAMPLE_SIZE}`, () => {
    expect(deriveRweEdge(makeEffect({ sampleSize: RWE_MIN_SAMPLE_SIZE }))).not.toBeNull()
  })

  it("suppresses non-finite sample sizes", () => {
    expect(deriveRweEdge(makeEffect({ sampleSize: Number.NaN }))).toBeNull()
  })
})

// ── Honesty: edge type + grade ceiling ────────────────────────────────────────

describe("deriveRweEdge — honesty contract", () => {
  it("always uses POPULATION_ASSOCIATION edge type, never a mechanistic type", () => {
    const edge = deriveRweEdge(makeEffect())
    expect(edge?.edgeType).toBe(KgEdgeType.POPULATION_ASSOCIATION)
  })

  it("never returns A_HIGH or B_MODERATE for any input", () => {
    const cases: PopulationEffect[] = [
      makeEffect({ sampleSize: 100000, pValue: 0.0000001, confidence: 1 }),
      makeEffect({ sampleSize: 5000, pValue: 0.0001 }),
      makeEffect({ sampleSize: 50, pValue: 0.05 }),
    ]
    for (const c of cases) {
      const edge = deriveRweEdge(c)
      expect(edge).not.toBeNull()
      expect([KgEvidenceGrade.C_LOW, KgEvidenceGrade.D_VERY_LOW]).toContain(edge!.evidenceGrade)
    }
  })

  it("stamps the RWE source tag", () => {
    expect(deriveRweEdge(makeEffect())?.source).toBe(RWE_SOURCE)
  })

  it("carries the population_association claim type and honesty note", () => {
    const edge = deriveRweEdge(makeEffect())
    expect(edge?.attributes.claimType).toBe("population_association")
    expect(edge?.attributes.note).toMatch(/Not a validated/i)
  })
})

// ── Grade derivation ──────────────────────────────────────────────────────────

describe("deriveRweEvidenceGrade", () => {
  it(`returns C_LOW when n >= ${RWE_CLOW_SAMPLE_SIZE} AND p <= 0.05`, () => {
    expect(deriveRweEvidenceGrade(50, 0.05)).toBe(KgEvidenceGrade.C_LOW)
    expect(deriveRweEvidenceGrade(120, 0.01)).toBe(KgEvidenceGrade.C_LOW)
  })

  it("returns D_VERY_LOW when sample size is adequate but p is not significant", () => {
    expect(deriveRweEvidenceGrade(120, 0.2)).toBe(KgEvidenceGrade.D_VERY_LOW)
  })

  it("returns D_VERY_LOW when p is significant but sample size is too small", () => {
    expect(deriveRweEvidenceGrade(RWE_CLOW_SAMPLE_SIZE - 1, 0.001)).toBe(KgEvidenceGrade.D_VERY_LOW)
  })

  it("returns D_VERY_LOW when p-value is null/undefined regardless of n", () => {
    expect(deriveRweEvidenceGrade(100000, null)).toBe(KgEvidenceGrade.D_VERY_LOW)
    expect(deriveRweEvidenceGrade(100000, undefined)).toBe(KgEvidenceGrade.D_VERY_LOW)
  })
})

// ── Passthrough + node identity ───────────────────────────────────────────────

describe("deriveRweEdge — field mapping", () => {
  it("maps subject → from and object → to node identities", () => {
    const edge = deriveRweEdge(makeEffect())
    expect(edge?.fromKind).toBe("compound")
    expect(edge?.fromExternalId).toBe("CHEMBL413")
    expect(edge?.fromLabel).toBe("Rapamycin")
    expect(edge?.toKind).toBe("biomarker")
    expect(edge?.toExternalId).toBe("hs_crp")
    expect(edge?.toLabel).toBe("hs-CRP")
  })

  it("passes through effectSize, unit, stdDev, pValue, and period", () => {
    const edge = deriveRweEdge(makeEffect())
    expect(edge?.effectSize).toBe(-0.18)
    expect(edge?.effectSizeUnit).toBe("z-score")
    expect(edge?.attributes.stdDev).toBe(0.4)
    expect(edge?.attributes.pValue).toBe(0.01)
    expect(edge?.attributes.period).toBe("2026-Q2")
    expect(edge?.attributes.sampleSize).toBe(120)
  })

  it("defaults optional unit/stdDev/pValue to null", () => {
    const edge = deriveRweEdge(
      makeEffect({ effectSizeUnit: undefined, stdDev: undefined, pValue: undefined }),
    )
    expect(edge?.effectSizeUnit).toBeNull()
    expect(edge?.attributes.stdDev).toBeNull()
    expect(edge?.attributes.pValue).toBeNull()
  })

  it("clamps confidence into [0,1]", () => {
    expect(deriveRweEdge(makeEffect({ confidence: 1.5 }))?.confidence).toBe(1)
    expect(deriveRweEdge(makeEffect({ confidence: -0.3 }))?.confidence).toBe(0)
  })

  it("leaves confidence null when not provided", () => {
    expect(deriveRweEdge(makeEffect({ confidence: null }))?.confidence).toBeNull()
  })

  it("never attaches pubmedIds to an RWE edge", () => {
    expect(deriveRweEdge(makeEffect())?.pubmedIds).toBeNull()
  })
})

// ── biomarkerFromBucket ───────────────────────────────────────────────────────

describe("biomarkerFromBucket", () => {
  it("extracts the biomarker label from a compound-branch bucket", () => {
    expect(biomarkerFromBucket("biomarker:hs-CRP")).toBe("hs-CRP")
  })

  it("returns null for non-biomarker buckets", () => {
    expect(biomarkerFromBucket("all")).toBeNull()
    expect(biomarkerFromBucket("30-39")).toBeNull()
  })

  it("returns null for an empty biomarker name", () => {
    expect(biomarkerFromBucket("biomarker:")).toBeNull()
    expect(biomarkerFromBucket("biomarker:   ")).toBeNull()
  })
})

// ── planRweMaterialization ────────────────────────────────────────────────────

function makeRow(overrides: Partial<AggregateOutcomeRow> = {}): AggregateOutcomeRow {
  return {
    compoundId: "cmp-1",
    cohortBucket: "biomarker:hs-CRP",
    sampleSize: 120,
    meanOutcomeScore: -0.18,
    stdDev: 0.4,
    pValue: 0.01,
    confidence: 0.7,
    period: "2026-Q2",
    ...overrides,
  }
}

const COMPOUNDS = new Map<string, CompoundIdentity>([
  ["cmp-1", { name: "Rapamycin", casNumber: "53123-88-9", pubChemCid: "5284616" }],
])

describe("planRweMaterialization", () => {
  it("ignores non-compound-branch rows (not scanned)", () => {
    const plan = planRweMaterialization({
      tenantId: "default",
      aggregates: [makeRow({ cohortBucket: "all" }), makeRow({ cohortBucket: "30-39" })],
      compoundsById: COMPOUNDS,
    })
    expect(plan.scanned).toBe(0)
    expect(plan.edges).toHaveLength(0)
  })

  it("skips compound-branch rows with no resolvable compound", () => {
    const plan = planRweMaterialization({
      tenantId: "default",
      aggregates: [makeRow({ compoundId: null }), makeRow({ compoundId: "missing" })],
      compoundsById: COMPOUNDS,
    })
    expect(plan.scanned).toBe(2)
    expect(plan.skippedNoCompound).toBe(2)
    expect(plan.edges).toHaveLength(0)
  })

  it("suppresses rows below the sample-size floor", () => {
    const plan = planRweMaterialization({
      tenantId: "default",
      aggregates: [makeRow({ sampleSize: RWE_MIN_SAMPLE_SIZE - 1 })],
      compoundsById: COMPOUNDS,
    })
    expect(plan.scanned).toBe(1)
    expect(plan.suppressed).toBe(1)
    expect(plan.edges).toHaveLength(0)
  })

  it("produces an edge with canonical node identities for a valid row", () => {
    const plan = planRweMaterialization({
      tenantId: "default",
      aggregates: [makeRow()],
      compoundsById: COMPOUNDS,
    })
    expect(plan.edges).toHaveLength(1)
    const edge = plan.edges[0]
    expect(edge.fromKind).toBe("compound")
    expect(edge.fromLabel).toBe("Rapamycin")
    expect(edge.fromExternalId.startsWith(NODE_IDENTITY_PREFIX)).toBe(true)
    expect(edge.toKind).toBe("biomarker")
    expect(edge.toLabel).toBe("hs-CRP")
    expect(edge.toExternalId.startsWith(NODE_IDENTITY_PREFIX)).toBe(true)
    expect(edge.effectSize).toBe(-0.18)
    expect(edge.attributes.pValue).toBe(0.01)
    expect(edge.source).toBe(RWE_SOURCE)
  })

  it("reports mixed counters across a batch", () => {
    const plan = planRweMaterialization({
      tenantId: "default",
      aggregates: [
        makeRow(), // edge
        makeRow({ sampleSize: 5 }), // suppressed
        makeRow({ compoundId: null }), // skipped
        makeRow({ cohortBucket: "all" }), // ignored
      ],
      compoundsById: COMPOUNDS,
    })
    expect(plan.scanned).toBe(3)
    expect(plan.edges).toHaveLength(1)
    expect(plan.suppressed).toBe(1)
    expect(plan.skippedNoCompound).toBe(1)
  })

  it("gives the same compound node identity across different biomarker rows", () => {
    const plan = planRweMaterialization({
      tenantId: "default",
      aggregates: [makeRow({ cohortBucket: "biomarker:hs-CRP" }), makeRow({ cohortBucket: "biomarker:IL-6" })],
      compoundsById: COMPOUNDS,
    })
    expect(plan.edges).toHaveLength(2)
    expect(plan.edges[0].fromExternalId).toBe(plan.edges[1].fromExternalId)
    expect(plan.edges[0].toExternalId).not.toBe(plan.edges[1].toExternalId)
  })
})
