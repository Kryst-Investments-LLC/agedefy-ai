import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()
const applyRateLimitMock = vi.fn(() => null)
const ensureScientistProfileMock = vi.fn()
const buildDiscoverySlugMock = vi.fn()
const logAuditMock = vi.fn()

const dbMock = {
  experimentCandidate: { findFirst: vi.fn() },
  marketplaceDiscovery: { findFirst: vi.fn(), create: vi.fn() },
  marketplaceFundingRequest: { create: vi.fn() },
}

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: applyRateLimitMock }))
vi.mock("@/lib/db", () => ({ db: dbMock }))
vi.mock("@/scientist-sponsor-marketplace/backend/services/scientistService", () => ({
  ensureScientistProfile: ensureScientistProfileMock,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/services/discoveryService", () => ({
  buildDiscoverySlug: buildDiscoverySlugMock,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/services/auditService", () => ({
  logMarketplaceAuditEvent: logAuditMock,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/models/normalizers", () => ({
  normalizeDiscovery: (r: unknown) => ({ ...(r as object), _normalized: true }),
  normalizeFundingRequest: (r: unknown) => ({ ...(r as object), _normalized: true }),
}))
vi.mock("@/scientist-sponsor-marketplace/backend/models/json", () => ({
  toJsonValue: (v: unknown) => v,
}))

const AUTHED = { user: { id: "user-1", name: "Dr. Researcher", role: "MEMBER" } }

const SCREENED_CANDIDATE = {
  id: "cand-1",
  userId: "user-1",
  status: "SCREENED",
  displayName: "Compound X",
  kind: "CHEMBL",
  chemblId: "CHEMBL999",
  smiles: "CC(=O)O",
  targetName: "SIRT1",
  targetChemblId: "CHEMBL828",
  hypothesisNote: "Activates longevity pathway.",
  screenJson: null,
  dockJson: null,
}

const CREATED_DISCOVERY = {
  id: "disc-1",
  scientistId: "sci-1",
  title: "Validation: Compound X → SIRT1",
  slug: "validation-compound-x",
  category: "Therapeutics",
  developmentStage: "preclinical",
  candidateId: "cand-1",
  metadata: { validationListing: true, candidateId: "cand-1", requestedAssays: ["IC50_SIRT1"] },
  evidenceLinks: [],
  status: "DRAFT",
  scientificImpactScore: 0.65,
  commercialReadiness: 0.4,
  fundingGoalCents: 100000,
  currency: "USD",
  publishedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const CREATED_FUNDING_REQUEST = {
  id: "fr-1",
  discoveryId: "disc-1",
  scientistId: "sci-1",
  requestedAmountCents: 100000,
  currency: "USD",
  useOfFunds: "Fund validation",
  timelineMonths: 6,
  status: "DRAFT",
  milestonePlan: [],
  evidenceUploads: [],
  publishedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/scientist-sponsor-marketplace/validation-listings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  applyRateLimitMock.mockReturnValue(null)
  getServerSessionMock.mockResolvedValue(AUTHED)
  ensureScientistProfileMock.mockResolvedValue({ id: "sci-1" })
  buildDiscoverySlugMock.mockResolvedValue("validation-compound-x")
  dbMock.experimentCandidate.findFirst.mockResolvedValue(SCREENED_CANDIDATE)
  dbMock.marketplaceDiscovery.findFirst.mockResolvedValue(null)
  dbMock.marketplaceDiscovery.create.mockResolvedValue(CREATED_DISCOVERY)
  dbMock.marketplaceFundingRequest.create.mockResolvedValue(CREATED_FUNDING_REQUEST)
  logAuditMock.mockResolvedValue({})
})

afterEach(() => { vi.resetModules() })

const VALID_BODY = {
  candidateId: "cand-1",
  fundingGoalCents: 100000,
  requestedAssays: ["IC50_SIRT1", "GI50"],
}

describe("POST /api/scientist-sponsor-marketplace/validation-listings", () => {
  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    const res = await POST(postReq(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid body (missing candidateId)", async () => {
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    const res = await POST(postReq({ fundingGoalCents: 100000 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid body (negative fundingGoalCents)", async () => {
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    const res = await POST(postReq({ candidateId: "cand-1", fundingGoalCents: -1 }))
    expect(res.status).toBe(400)
  })

  it("returns 404 when candidate not found or not owned by user", async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue(null)
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    const res = await POST(postReq(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it("returns 422 when candidate is PROPOSED (wrong status)", async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue({ ...SCREENED_CANDIDATE, status: "PROPOSED" })
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    const res = await POST(postReq(VALID_BODY))
    expect(res.status).toBe(422)
    const body = await res.json() as { currentStatus: string }
    expect(body.currentStatus).toBe("PROPOSED")
  })

  it("returns 422 when candidate is RESULT_LOGGED", async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue({ ...SCREENED_CANDIDATE, status: "RESULT_LOGGED" })
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    const res = await POST(postReq(VALID_BODY))
    expect(res.status).toBe(422)
  })

  it("returns 409 when a listing already exists for this candidate", async () => {
    dbMock.marketplaceDiscovery.findFirst.mockResolvedValue({ id: "existing-disc" })
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    const res = await POST(postReq(VALID_BODY))
    expect(res.status).toBe(409)
    const body = await res.json() as { existingDiscoveryId: string }
    expect(body.existingDiscoveryId).toBe("existing-disc")
  })

  it("returns 201 with discovery and fundingRequest on success (SCREENED candidate)", async () => {
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    const res = await POST(postReq(VALID_BODY))
    expect(res.status).toBe(201)
    const body = await res.json() as { discovery: { id: string }; fundingRequest: { id: string } }
    expect(body.discovery.id).toBe("disc-1")
    expect(body.fundingRequest.id).toBe("fr-1")
  })

  it("returns 201 when candidate is SENT_TO_LAB (already in progress)", async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue({ ...SCREENED_CANDIDATE, status: "SENT_TO_LAB" })
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    const res = await POST(postReq(VALID_BODY))
    expect(res.status).toBe(201)
  })

  it("sets validationListing=true and candidateId in discovery metadata", async () => {
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    await POST(postReq(VALID_BODY))
    const createCall = dbMock.marketplaceDiscovery.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createCall.data.candidateId).toBe("cand-1")
    const meta = createCall.data.metadata as Record<string, unknown>
    expect(meta.validationListing).toBe(true)
    expect(meta.requestedAssays).toEqual(["IC50_SIRT1", "GI50"])
  })

  it("derives category from candidate kind (CHEMBL → Therapeutics)", async () => {
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    await POST(postReq(VALID_BODY))
    const createCall = dbMock.marketplaceDiscovery.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createCall.data.category).toBe("Therapeutics")
  })

  it("derives developmentStage from candidate status (SCREENED → preclinical)", async () => {
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    await POST(postReq(VALID_BODY))
    const createCall = dbMock.marketplaceDiscovery.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createCall.data.developmentStage).toBe("preclinical")
  })

  it("logs an audit event after creation", async () => {
    const { POST } = await import("@/app/api/scientist-sponsor-marketplace/validation-listings/route")
    await POST(postReq(VALID_BODY))
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "validation_listing.created", entityType: "Discovery" }),
    )
  })
})
