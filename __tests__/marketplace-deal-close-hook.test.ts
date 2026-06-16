import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const generateSubmissionTokenMock = vi.fn()
const buildLabPackageMock = vi.fn()
const billingServiceMock = { createEscrowAuthorization: vi.fn() }
const transactionServiceMock = { create: vi.fn() }
const dealRoomServiceMock = { update: vi.fn() }
const postDealRoomMessageMock = vi.fn()
const notifyMock = vi.fn()
const logAuditMock = vi.fn()

const dbMock = {
  marketplaceDiscovery: { findUnique: vi.fn() },
  experimentCandidate: { findUnique: vi.fn(), update: vi.fn() },
  marketplaceSponsor: { findUnique: vi.fn() },
  labSubmission: { create: vi.fn(), update: vi.fn() },
}

vi.mock("@prisma/client", () => ({ Prisma: {} }))
vi.mock("@/lib/db", () => ({ db: dbMock }))
vi.mock("@/lib/lab-package", () => ({
  generateSubmissionToken: generateSubmissionTokenMock,
  buildLabPackage: buildLabPackageMock,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/models/json", () => ({
  toJsonValue: (v: unknown) => v,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/services/billingService", () => ({
  billingService: billingServiceMock,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/services/transactionService", () => ({
  transactionService: transactionServiceMock,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/services/dealRoomService", () => ({
  dealRoomService: dealRoomServiceMock,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/services/messageThreadService", () => ({
  postDealRoomMessage: postDealRoomMessageMock,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/services/notificationService", () => ({
  notifyMarketplaceUser: notifyMock,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/services/auditService", () => ({
  logMarketplaceAuditEvent: logAuditMock,
}))
vi.mock("@/scientist-sponsor-marketplace/backend/services/paymentLifecycleService", () => ({
  approveAndReleaseMarketplaceTransaction: vi.fn(),
  markMarketplaceMilestoneComplete: vi.fn(),
  rejectMarketplaceTransactionReview: vi.fn(),
}))

const BASE_INPUT = {
  dealRoomId: "dr-1",
  discoveryId: "disc-1",
  sponsorId: "spon-1",
  sponsorUserId: "user-spon",
  sponsorUserEmail: "spon@example.com",
  sponsorUserName: "Sponsor Corp",
  scientistUserId: "user-sci",
  amountCents: 100000,
  currency: "USD",
  subscriptionTier: "growth" as const,
}

const AUTHORIZATION = {
  status: "AUTHORIZED",
  platformFeeCents: 700,
  transactionFeeCents: 175,
  payoutCents: 99125,
  providerReference: "ref-123",
}

const TRANSACTION = { id: "tx-1", dealRoomId: "dr-1", status: "AUTHORIZED" }

const VALIDATION_DISCOVERY = {
  id: "disc-1",
  metadata: { validationListing: true, candidateId: "cand-1", requestedAssays: ["IC50_SIRT1"] },
}

const GENERIC_DISCOVERY = {
  id: "disc-1",
  metadata: { title: "Generic discovery" },
}

const CANDIDATE = {
  id: "cand-1",
  status: "SCREENED",
  displayName: "Compound X",
  kind: "CHEMBL",
  smiles: "CC",
  chemblId: "CHEMBL1",
  targetName: "SIRT1",
  targetChemblId: "CHEMBL828",
  hypothesisNote: null,
  screenJson: null,
  dockJson: null,
}

const SPONSOR_RECORD = { organizationName: "CRO Bio", user: { email: "cro@example.com" } }

beforeEach(() => {
  vi.resetAllMocks()
  billingServiceMock.createEscrowAuthorization.mockResolvedValue(AUTHORIZATION)
  transactionServiceMock.create.mockResolvedValue(TRANSACTION)
  dealRoomServiceMock.update.mockResolvedValue({})
  postDealRoomMessageMock.mockResolvedValue({})
  notifyMock.mockResolvedValue({})
  logAuditMock.mockResolvedValue({})
  dbMock.marketplaceDiscovery.findUnique.mockResolvedValue(GENERIC_DISCOVERY)
  dbMock.experimentCandidate.findUnique.mockResolvedValue(CANDIDATE)
  dbMock.experimentCandidate.update.mockResolvedValue({})
  dbMock.marketplaceSponsor.findUnique.mockResolvedValue(SPONSOR_RECORD)
  dbMock.labSubmission.create.mockResolvedValue({ id: "lsub-1" })
  dbMock.labSubmission.update.mockResolvedValue({})
  generateSubmissionTokenMock.mockReturnValue({ token: "tok123", tokenHash: "hash123" })
  buildLabPackageMock.mockReturnValue({ submission_ref: "lsub-1" })
})

afterEach(() => { vi.resetModules() })

describe("dealWorkflow.processPayment — deal close → LabSubmission hook", () => {
  it("does NOT create a LabSubmission for a generic discovery (no candidateId)", async () => {
    dbMock.marketplaceDiscovery.findUnique.mockResolvedValue(GENERIC_DISCOVERY)
    const { dealWorkflow } = await import("@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow")
    await dealWorkflow.processPayment(BASE_INPUT)
    expect(dbMock.labSubmission.create).not.toHaveBeenCalled()
  })

  it("creates a LabSubmission when discovery has candidateId in metadata", async () => {
    dbMock.marketplaceDiscovery.findUnique.mockResolvedValue(VALIDATION_DISCOVERY)
    const { dealWorkflow } = await import("@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow")
    await dealWorkflow.processPayment(BASE_INPUT)
    expect(dbMock.labSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          candidateId: "cand-1",
          userId: "user-sci",
          tokenHash: "hash123",
        }),
      }),
    )
  })

  it("builds and stores the lab package with the real submission ID", async () => {
    dbMock.marketplaceDiscovery.findUnique.mockResolvedValue(VALIDATION_DISCOVERY)
    const { dealWorkflow } = await import("@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow")
    await dealWorkflow.processPayment(BASE_INPUT)
    expect(buildLabPackageMock).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "lsub-1" }),
    )
    expect(dbMock.labSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "lsub-1" } }),
    )
  })

  it("advances candidate from SCREENED to SENT_TO_LAB", async () => {
    dbMock.marketplaceDiscovery.findUnique.mockResolvedValue(VALIDATION_DISCOVERY)
    const { dealWorkflow } = await import("@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow")
    await dealWorkflow.processPayment(BASE_INPUT)
    expect(dbMock.experimentCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SENT_TO_LAB" } }),
    )
  })

  it("does NOT advance candidate already at SENT_TO_LAB", async () => {
    dbMock.marketplaceDiscovery.findUnique.mockResolvedValue(VALIDATION_DISCOVERY)
    dbMock.experimentCandidate.findUnique.mockResolvedValue({ ...CANDIDATE, status: "SENT_TO_LAB" })
    const { dealWorkflow } = await import("@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow")
    await dealWorkflow.processPayment(BASE_INPUT)
    expect(dbMock.experimentCandidate.update).not.toHaveBeenCalled()
  })

  it("posts a SYSTEM message with the submission ref and token", async () => {
    dbMock.marketplaceDiscovery.findUnique.mockResolvedValue(VALIDATION_DISCOVERY)
    const { dealWorkflow } = await import("@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow")
    await dealWorkflow.processPayment(BASE_INPUT)
    const systemMsg = postDealRoomMessageMock.mock.calls.find(
      (call: unknown[]) => (call[0] as { messageType?: string }).messageType === "SYSTEM",
    )
    expect(systemMsg).toBeDefined()
    const body = (systemMsg![0] as { body: string }).body
    expect(body).toContain("lsub-1")
    expect(body).toContain("tok123")
  })

  it("returns labSubmissionId in the result for validation deals", async () => {
    dbMock.marketplaceDiscovery.findUnique.mockResolvedValue(VALIDATION_DISCOVERY)
    const { dealWorkflow } = await import("@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow")
    const result = await dealWorkflow.processPayment(BASE_INPUT)
    expect((result as { labSubmissionId?: string }).labSubmissionId).toBe("lsub-1")
  })

  it("returns labSubmissionId as null for generic deals", async () => {
    const { dealWorkflow } = await import("@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow")
    const result = await dealWorkflow.processPayment(BASE_INPUT)
    expect((result as { labSubmissionId?: string | null }).labSubmissionId).toBeNull()
  })

  it("skips LabSubmission if candidate not found (graceful degradation)", async () => {
    dbMock.marketplaceDiscovery.findUnique.mockResolvedValue(VALIDATION_DISCOVERY)
    dbMock.experimentCandidate.findUnique.mockResolvedValue(null)
    const { dealWorkflow } = await import("@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow")
    const result = await dealWorkflow.processPayment(BASE_INPUT)
    expect(dbMock.labSubmission.create).not.toHaveBeenCalled()
    expect((result as { labSubmissionId?: string | null }).labSubmissionId).toBeNull()
  })
})
