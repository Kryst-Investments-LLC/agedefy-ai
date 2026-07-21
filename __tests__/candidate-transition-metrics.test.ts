import { describe, expect, it, vi } from "vitest"

import {
  candidateStageDurationHistogram,
  candidateTransitionCounter,
  recordCandidateTransition,
} from "@/lib/observability/telemetry"

describe("recordCandidateTransition (OBS-004 candidate-workflow SLI)", () => {
  it("records the transition counter with from/to labels and stage latency", () => {
    const counterSpy = vi.spyOn(candidateTransitionCounter, "add")
    const histSpy = vi.spyOn(candidateStageDurationHistogram, "record")

    recordCandidateTransition({ fromStatus: "PROPOSED", toStatus: "SCREENED", stageDurationMs: 1234 })

    expect(counterSpy).toHaveBeenCalledWith(1, { from_status: "PROPOSED", to_status: "SCREENED" })
    expect(histSpy).toHaveBeenCalledWith(1234, { stage: "PROPOSED" })

    counterSpy.mockRestore()
    histSpy.mockRestore()
  })

  it("labels a null fromStatus as 'none' and skips stage latency when absent or negative", () => {
    const counterSpy = vi.spyOn(candidateTransitionCounter, "add")
    const histSpy = vi.spyOn(candidateStageDurationHistogram, "record")

    recordCandidateTransition({ fromStatus: null, toStatus: "PROPOSED" })
    expect(counterSpy).toHaveBeenCalledWith(1, { from_status: "none", to_status: "PROPOSED" })
    expect(histSpy).not.toHaveBeenCalled()

    // A negative computed duration (clock skew) is dropped, not recorded.
    recordCandidateTransition({ fromStatus: "SCREENED", toStatus: "SENT_TO_LAB", stageDurationMs: -5 })
    expect(histSpy).not.toHaveBeenCalled()

    counterSpy.mockRestore()
    histSpy.mockRestore()
  })
})
