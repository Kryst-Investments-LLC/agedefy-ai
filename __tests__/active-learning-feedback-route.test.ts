import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getServerSessionMock = vi.fn()

const dbMock = {
  experimentCandidate: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  candidateFeedbackRun: { create: vi.fn() },
  experimentCandidateEvent: { create: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock)),
}

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/db", () => ({ db: dbMock }))
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

const AUTHED = { user: { id: "user-1" } }

const CANDIDATE_RESULT_LOGGED = {
  id: "cand-1",
  userId: "user-1",
  status: "RESULT_LOGGED",
  displayName: "Compound X",
  screenJson: { qed: 0.7, mol_log_p: 2.5, molecular_weight: 350 },
  labResults: [
    { value: 0.5, unit: "µM", operator: "=", flag: "active", assayType: "biochemical" },
    { value: 5, unit: "µM", operator: ">", flag: "inactive", assayType: "cellular" },
  ],
}

const FEEDBACK_RUN = {
  id: "run-1",
  candidateId: "cand-1",
  feedbackScore: 0.42,
  uncertaintyScore: 0.3,
  activityScore: 0.5,
  selectivityScore: 0.5,
  toxicityScore: 1,
  nResults: 2,
  rationale: "2 results: ...",
}

function postReq(id: string) {
  return new NextRequest(`http://localhost/api/experiment/candidates/${id}/feedback`, {
    method: "POST",
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  getServerSessionMock.mockResolvedValue(AUTHED)
  dbMock.experimentCandidate.findFirst.mockResolvedValue(CANDIDATE_RESULT_LOGGED)
  dbMock.experimentCandidate.findMany.mockResolvedValue([])
  dbMock.experimentCandidate.update.mockResolvedValue({ ...CANDIDATE_RESULT_LOGGED, status: "FED_BACK", feedbackScore: 0.42 })
  dbMock.candidateFeedbackRun.create.mockResolvedValue(FEEDBACK_RUN)
  dbMock.experimentCandidateEvent.create.mockResolvedValue({})
})

afterEach(() => { vi.resetModules() })

describe("POST /api/experiment/candidates/[id]/feedback", () => {
  it("returns 401 when unauthenticated", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const { POST } = await import("@/app/api/experiment/candidates/[id]/feedback/route")
    const res = await POST(postReq("cand-1"), { params: Promise.resolve({ id: "cand-1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 404 when candidate not found or not owned", async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue(null)
    const { POST } = await import("@/app/api/experiment/candidates/[id]/feedback/route")
    const res = await POST(postReq("cand-1"), { params: Promise.resolve({ id: "cand-1" }) })
    expect(res.status).toBe(404)
  })

  it("returns 422 when candidate is not RESULT_LOGGED or FED_BACK", async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue({ ...CANDIDATE_RESULT_LOGGED, status: "PROPOSED" })
    const { POST } = await import("@/app/api/experiment/candidates/[id]/feedback/route")
    const res = await POST(postReq("cand-1"), { params: Promise.resolve({ id: "cand-1" }) })
    expect(res.status).toBe(422)
    const body = await res.json() as { currentStatus: string }
    expect(body.currentStatus).toBe("PROPOSED")
  })

  it("returns 200 with candidate and feedbackRun on success", async () => {
    const { POST } = await import("@/app/api/experiment/candidates/[id]/feedback/route")
    const res = await POST(postReq("cand-1"), { params: Promise.resolve({ id: "cand-1" }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { candidate: { id: string }; feedbackRun: { id: string } }
    expect(body.candidate).toBeDefined()
    expect(body.feedbackRun.id).toBe("run-1")
  })

  it("advances candidate status to FED_BACK", async () => {
    const { POST } = await import("@/app/api/experiment/candidates/[id]/feedback/route")
    await POST(postReq("cand-1"), { params: Promise.resolve({ id: "cand-1" }) })
    expect(dbMock.experimentCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FED_BACK" }) }),
    )
  })

  it("writes feedbackScore, uncertaintyScore, acquisitionScore to candidate", async () => {
    const { POST } = await import("@/app/api/experiment/candidates/[id]/feedback/route")
    await POST(postReq("cand-1"), { params: Promise.resolve({ id: "cand-1" }) })
    const updateCall = dbMock.experimentCandidate.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(typeof updateCall.data.feedbackScore).toBe("number")
    expect(typeof updateCall.data.uncertaintyScore).toBe("number")
    expect(typeof updateCall.data.acquisitionScore).toBe("number")
  })

  it("creates a CandidateFeedbackRun with nResults and rationale", async () => {
    const { POST } = await import("@/app/api/experiment/candidates/[id]/feedback/route")
    await POST(postReq("cand-1"), { params: Promise.resolve({ id: "cand-1" }) })
    expect(dbMock.candidateFeedbackRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          candidateId: "cand-1",
          userId: "user-1",
          nResults: 2,
        }),
      }),
    )
  })

  it("writes a FED_BACK transition event when starting from RESULT_LOGGED", async () => {
    const { POST } = await import("@/app/api/experiment/candidates/[id]/feedback/route")
    await POST(postReq("cand-1"), { params: Promise.resolve({ id: "cand-1" }) })
    expect(dbMock.experimentCandidateEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: "RESULT_LOGGED",
          toStatus: "FED_BACK",
        }),
      }),
    )
  })

  it("does NOT write a transition event when candidate is already FED_BACK (idempotent re-run)", async () => {
    dbMock.experimentCandidate.findFirst.mockResolvedValue({ ...CANDIDATE_RESULT_LOGGED, status: "FED_BACK" })
    const { POST } = await import("@/app/api/experiment/candidates/[id]/feedback/route")
    await POST(postReq("cand-1"), { params: Promise.resolve({ id: "cand-1" }) })
    expect(dbMock.experimentCandidateEvent.create).not.toHaveBeenCalled()
  })
})
