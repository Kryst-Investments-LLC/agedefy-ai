import { describe, expect, it } from "vitest"

import { onboardingCompleteSchema } from "@/lib/validators/onboarding"

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
