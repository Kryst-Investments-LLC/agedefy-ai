import { describe, expect, it } from "vitest"

import { ageInYears, MIN_ELIGIBLE_AGE_YEARS, onboardingCompleteSchema } from "@/lib/validators/onboarding"

function dobForAge(years: number): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - years)
  return d.toISOString().slice(0, 10)
}

// The onboarding route rejects (400) when consent is absent — enforced by the
// schema requiring consent.dataProcessing === true. This proves the server-side
// enforcement independent of the frontend checkbox.
const baseSteps = {
  step1: { dateOfBirth: "1990-01-01", biologicalSex: "male" as const },
  step2: { healthGoals: ["cognitive" as const], primaryMotivation: "stay sharp", riskTolerance: "medium" as const },
  step3: { healthConditions: [], supplementStack: [] },
  step4: { dietaryPattern: "omnivore" as const, activityLevel: "moderate" as const, sleepQuality: 3, stressLevel: 3 },
}

describe("onboarding consent validation", () => {
  it("rejects onboarding without data-processing consent", () => {
    const missing = onboardingCompleteSchema.safeParse({ ...baseSteps })
    expect(missing.success).toBe(false)

    const denied = onboardingCompleteSchema.safeParse({
      ...baseSteps,
      consent: { dataProcessing: false, aiHealthInfo: false },
    })
    expect(denied.success).toBe(false)
  })

  it("accepts onboarding with data-processing consent and defaults aiHealthInfo to false", () => {
    const parsed = onboardingCompleteSchema.safeParse({
      ...baseSteps,
      consent: { dataProcessing: true },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.consent.dataProcessing).toBe(true)
      expect(parsed.data.consent.aiHealthInfo).toBe(false)
    }
  })
})

describe("onboarding age eligibility (P0-GOV-009)", () => {
  const consent = { dataProcessing: true as const, aiHealthInfo: false }

  it("computes whole-year age from a date of birth", () => {
    expect(ageInYears("2000-01-01", new Date("2020-01-01T00:00:00Z"))).toBe(20)
    expect(ageInYears("2000-06-15", new Date("2020-06-14T00:00:00Z"))).toBe(19) // birthday not yet reached
    expect(ageInYears("2000-06-15", new Date("2020-06-15T00:00:00Z"))).toBe(20)
  })

  it("rejects onboarding for a user under the minimum age", () => {
    const under = onboardingCompleteSchema.safeParse({
      ...baseSteps,
      step1: { dateOfBirth: dobForAge(MIN_ELIGIBLE_AGE_YEARS - 1), biologicalSex: "male" as const },
      consent,
    })
    expect(under.success).toBe(false)
  })

  it("accepts onboarding for a user at or above the minimum age", () => {
    const eligible = onboardingCompleteSchema.safeParse({
      ...baseSteps,
      step1: { dateOfBirth: dobForAge(MIN_ELIGIBLE_AGE_YEARS + 1), biologicalSex: "male" as const },
      consent,
    })
    expect(eligible.success).toBe(true)
  })

  it("rejects a future date of birth", () => {
    const future = onboardingCompleteSchema.safeParse({
      ...baseSteps,
      step1: { dateOfBirth: "2999-01-01", biologicalSex: "male" as const },
      consent,
    })
    expect(future.success).toBe(false)
  })
})
