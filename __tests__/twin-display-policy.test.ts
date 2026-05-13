import { describe, expect, it } from "vitest"

import {
  getTwinDisplayPolicy,
  isClinicalGrade,
  synthesiseDisplayPolicy,
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

  it("labels each backend distinctly in the badge", () => {
    const mech = getTwinDisplayPolicy({
      backend_used: "mechanistic",
      trajectories: { a: TRAJ(false) },
    })
    const stat = getTwinDisplayPolicy({
      backend_used: "statistical",
      trajectories: { a: TRAJ(false) },
    })
    const hybr = getTwinDisplayPolicy({
      backend_used: "hybrid",
      trajectories: { a: TRAJ(false) },
    })
    expect(mech.badgeLabel).toBe("Calibrated (mechanistic ODE)")
    expect(stat.badgeLabel).toBe("Calibrated (statistical priors)")
    expect(hybr.badgeLabel).toBe("Calibrated (hybrid (mechanistic + statistical))")
  })

  it("partial-confidence badges include the backend descriptor", () => {
    const p = getTwinDisplayPolicy({
      backend_used: "mechanistic",
      trajectories: { ldl: TRAJ(true), a: TRAJ(false) },
    })
    expect(p.badgeLabel).toBe(
      "Calibrated (mechanistic ODE) — 1 outcome low-confidence",
    )
  })
})

describe("synthesiseDisplayPolicy", () => {
  it("matches getTwinDisplayPolicy's calibrated path for a bare backend tag", () => {
    const p = synthesiseDisplayPolicy("mechanistic")
    expect(p.tier).toBe("calibrated")
    expect(p.badgeLabel).toBe("Calibrated (mechanistic ODE)")
    expect(p.requiresClinicianBanner).toBe(false)
  })

  it("returns illustrative for fallback-exponential regardless of low_confidence list", () => {
    const p = synthesiseDisplayPolicy("fallback-exponential", ["hs_crp"])
    expect(p.tier).toBe("illustrative")
    expect(p.requiresClinicianBanner).toBe(true)
  })

  it("returns calibrated-partial when low_confidence_outcomes is non-empty", () => {
    const p = synthesiseDisplayPolicy("statistical", ["ldl", "hba1c"])
    expect(p.tier).toBe("calibrated-partial")
    expect(p.lowConfidenceOutcomes).toEqual(["hba1c", "ldl"])
    expect(p.badgeLabel).toMatch(/2 outcomes low-confidence/)
  })
})

describe("twin-display-policy PK/PD profile", () => {
  it("derives pkpdProfile=2-cmt from a mechanistic-sidecar pkpd-2cmt model_version", () => {
    const p = getTwinDisplayPolicy({
      backend_used: "mechanistic",
      model_version: "mechanistic-sidecar-pkpd-2cmt@0.4.0",
      trajectories: { a: TRAJ(false) },
    })
    expect(p.pkpdProfile).toBe("2-cmt")
    expect(p.badgeLabel).toBe("Calibrated (mechanistic ODE) · 2-compartment PK/PD")
  })

  it("defaults pkpdProfile=1-cmt for mechanistic runs without the pkpd-2cmt tag", () => {
    const p = getTwinDisplayPolicy({
      backend_used: "mechanistic",
      model_version: "mechanistic-sidecar@0.3.0",
      trajectories: { a: TRAJ(false) },
    })
    expect(p.pkpdProfile).toBe("1-cmt")
    expect(p.badgeLabel).toBe("Calibrated (mechanistic ODE)")
  })

  it("returns pkpdProfile=null for non-mechanistic backends even with pkpd-2cmt in version", () => {
    const stat = getTwinDisplayPolicy({
      backend_used: "statistical",
      model_version: "mechanistic-sidecar-pkpd-2cmt@0.4.0",
      trajectories: { a: TRAJ(false) },
    })
    expect(stat.pkpdProfile).toBeNull()
    expect(stat.badgeLabel).toBe("Calibrated (statistical priors)")
  })

  it("returns pkpdProfile=null for the in-process fallback", () => {
    const p = getTwinDisplayPolicy({
      backend_used: "fallback-exponential",
      model_version: "fallback-exponential@0.1.0",
      trajectories: { a: TRAJ(false) },
    })
    expect(p.pkpdProfile).toBeNull()
  })

  it("synthesiseDisplayPolicy honours an explicit pkpdProfile=2-cmt for mechanistic", () => {
    const p = synthesiseDisplayPolicy("mechanistic", [], "2-cmt")
    expect(p.pkpdProfile).toBe("2-cmt")
    expect(p.badgeLabel).toBe("Calibrated (mechanistic ODE) · 2-compartment PK/PD")
  })

  it("synthesiseDisplayPolicy ignores pkpdProfile for non-mechanistic backends", () => {
    const p = synthesiseDisplayPolicy("hybrid", [], "2-cmt")
    expect(p.pkpdProfile).toBeNull()
    expect(p.badgeLabel).toBe("Calibrated (hybrid (mechanistic + statistical))")
  })

  it("partial-confidence + 2-cmt badge stacks both suffixes", () => {
    const p = synthesiseDisplayPolicy("mechanistic", ["hs_crp"], "2-cmt")
    expect(p.badgeLabel).toBe(
      "Calibrated (mechanistic ODE) — 1 outcome low-confidence · 2-compartment PK/PD",
    )
  })
})
