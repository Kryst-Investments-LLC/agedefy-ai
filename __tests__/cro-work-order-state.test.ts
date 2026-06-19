import { describe, it, expect } from "vitest"
import { CroWorkOrderStatus } from "@prisma/client"

import {
  CRO_TRANSITIONS,
  CRO_TERMINAL_STATUSES,
  CroTransitionError,
  assertTransition,
  canTransition,
  checkTransitionRequirements,
  isTerminal,
  nextStatuses,
  requiresReconciledResults,
  type TransitionFacts,
} from "@/lib/cro/work-order-state"

const S = CroWorkOrderStatus

describe("CRO work-order state machine — happy path", () => {
  it("walks the full lifecycle DRAFT→…→RECONCILED", () => {
    const path = [S.DRAFT, S.QUOTED, S.FUNDED, S.IN_PROGRESS, S.DELIVERED, S.RECONCILED]
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true)
    }
  })

  it("allows CANCELLED from every non-terminal status", () => {
    for (const s of [S.DRAFT, S.QUOTED, S.FUNDED, S.IN_PROGRESS, S.DELIVERED]) {
      expect(canTransition(s, S.CANCELLED)).toBe(true)
    }
  })
})

describe("CRO work-order state machine — illegal transitions", () => {
  it("rejects skipping a stage", () => {
    expect(canTransition(S.DRAFT, S.FUNDED)).toBe(false)
    expect(canTransition(S.QUOTED, S.IN_PROGRESS)).toBe(false)
    expect(canTransition(S.FUNDED, S.DELIVERED)).toBe(false)
  })

  it("rejects going backwards", () => {
    expect(canTransition(S.FUNDED, S.QUOTED)).toBe(false)
    expect(canTransition(S.DELIVERED, S.IN_PROGRESS)).toBe(false)
  })

  it("rejects self-transitions", () => {
    expect(canTransition(S.FUNDED, S.FUNDED)).toBe(false)
  })

  it("treats RECONCILED and CANCELLED as terminal", () => {
    expect(nextStatuses(S.RECONCILED)).toEqual([])
    expect(nextStatuses(S.CANCELLED)).toEqual([])
    expect(isTerminal(S.RECONCILED)).toBe(true)
    expect(isTerminal(S.CANCELLED)).toBe(true)
    expect(CRO_TERMINAL_STATUSES.has(S.RECONCILED)).toBe(true)
  })

  it("non-terminal statuses are not terminal", () => {
    for (const s of [S.DRAFT, S.QUOTED, S.FUNDED, S.IN_PROGRESS, S.DELIVERED]) {
      expect(isTerminal(s)).toBe(false)
    }
  })
})

describe("assertTransition", () => {
  it("does not throw for a legal transition", () => {
    expect(() => assertTransition(S.DRAFT, S.QUOTED)).not.toThrow()
  })

  it("throws CroTransitionError for an illegal transition", () => {
    expect(() => assertTransition(S.DRAFT, S.RECONCILED)).toThrow(CroTransitionError)
  })

  it("the error carries from/to", () => {
    try {
      assertTransition(S.DRAFT, S.DELIVERED)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(CroTransitionError)
      expect((e as CroTransitionError).from).toBe(S.DRAFT)
      expect((e as CroTransitionError).to).toBe(S.DELIVERED)
    }
  })
})

describe("requiresReconciledResults", () => {
  it("is true only when advancing to RECONCILED", () => {
    expect(requiresReconciledResults(S.RECONCILED)).toBe(true)
    expect(requiresReconciledResults(S.DELIVERED)).toBe(false)
    expect(requiresReconciledResults(S.CANCELLED)).toBe(false)
  })
})

describe("checkTransitionRequirements", () => {
  const none: TransitionFacts = { hasEscrow: false, hasSubmission: false, reconciledResultCount: 0 }

  it("requires escrow for FUNDED", () => {
    expect(checkTransitionRequirements(S.FUNDED, none).ok).toBe(false)
    expect(checkTransitionRequirements(S.FUNDED, { ...none, hasEscrow: true }).ok).toBe(true)
  })

  it("requires a dispatched submission for IN_PROGRESS", () => {
    expect(checkTransitionRequirements(S.IN_PROGRESS, none).ok).toBe(false)
    expect(checkTransitionRequirements(S.IN_PROGRESS, { ...none, hasSubmission: true }).ok).toBe(true)
  })

  it("requires reconciled lab results for RECONCILED (integrity guard)", () => {
    const blocked = checkTransitionRequirements(S.RECONCILED, none)
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toMatch(/reconciled lab result/i)
    expect(checkTransitionRequirements(S.RECONCILED, { ...none, reconciledResultCount: 1 }).ok).toBe(true)
  })

  it("imposes no data requirement on QUOTED, DELIVERED, or CANCELLED", () => {
    expect(checkTransitionRequirements(S.QUOTED, none).ok).toBe(true)
    expect(checkTransitionRequirements(S.DELIVERED, none).ok).toBe(true)
    expect(checkTransitionRequirements(S.CANCELLED, none).ok).toBe(true)
  })
})

describe("transition table integrity", () => {
  it("defines transitions for every status", () => {
    for (const s of Object.values(S)) {
      expect(CRO_TRANSITIONS[s]).toBeDefined()
    }
  })

  it("never lists a status as its own successor", () => {
    for (const s of Object.values(S)) {
      expect(CRO_TRANSITIONS[s]).not.toContain(s)
    }
  })
})
