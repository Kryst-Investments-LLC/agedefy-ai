import { describe, expect, it } from "vitest"

import {
  getTwinDisplayPolicy,
  isClinicalGrade,
} from "@/lib/agents/twin-display-policy"

const TRAJ = (low = false) => ({
  weekly_means: [1, 1, 1],
  ci95_low: [0.9, 0.9, 0.9],
  ci95_high: [1.1, 1.1, 1.1],
  low_confidence_flag: low,
})

describe("twin-display-policy", () => {
  it("returns illustrative for the fallback backend regardless of confidence", () => {
    const policy = getTwinDisplayPolicy({
      backend_used: "fallback-exponential",
      trajectories: { a: TRAJ(false) },
    })
    expect(policy.tier).toBe("illustrative")
    expect(policy.isIllustrative).toBe(true)
    expect(policy.requiresClinicianBanner).toBe(true)
    expect(isClinicalGrade(null)).toBe(false)
  })

  it("returns calibrated when backend is mechanistic and no outcome is low-confidence", () => {
    const policy = getTwinDisplayPolicy({
      backend_used: "mechanistic",
      trajectories: { a: TRAJ(false), b: TRAJ(false) },
    })
    expect(policy.tier).toBe("calibrated")
    expect(policy.requiresClinicianBanner).toBe(false)
    expect(policy.lowConfidenceOutcomes).toEqual([])
    expect(
      isClinicalGrade({ backend_used: "hybrid", trajectories: { a: TRAJ(false) } }),
    ).toBe(true)
  })

  it("returns calibrated-partial and lists the flagged outcomes when ≥1 is low-confidence", () => {
    const policy = getTwinDisplayPolicy({
      backend_used: "hybrid",
      trajectories: { ldl: TRAJ(true), hba1c: TRAJ(false), hs_crp: TRAJ(true) },
    })
    expect(policy.tier).toBe("calibrated-partial")
    expect(policy.requiresClinicianBanner).toBe(true)
    expect(policy.lowConfidenceOutcomes).toEqual(["hs_crp", "ldl"])
    expect(policy.badgeLabel).toMatch(/2 outcomes low-confidence/)
  })

  it("treats null forecast as illustrative", () => {
    expect(getTwinDisplayPolicy(null).tier).toBe("illustrative")
    expect(getTwinDisplayPolicy(undefined).tier).toBe("illustrative")
  })
})
