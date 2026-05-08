import { describe, expect, it, vi } from 'vitest'

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    userProfile: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('onboarding validators', () => {
  it('exports all step schemas and complete schema', async () => {
    const mod = await import('@/lib/validators/onboarding')
    expect(mod.onboardingStep1Schema).toBeDefined()
    expect(mod.onboardingStep2Schema).toBeDefined()
    expect(mod.onboardingStep3Schema).toBeDefined()
    expect(mod.onboardingStep4Schema).toBeDefined()
    expect(mod.onboardingCompleteSchema).toBeDefined()
  })

  it('validates step1 correctly', async () => {
    const { onboardingStep1Schema } = await import('@/lib/validators/onboarding')

    const valid = onboardingStep1Schema.safeParse({
      dateOfBirth: '1990-05-15',
      biologicalSex: 'female',
    })
    expect(valid.success).toBe(true)

    const invalid = onboardingStep1Schema.safeParse({
      dateOfBirth: 'not-a-date',
      biologicalSex: 'invalid',
    })
    expect(invalid.success).toBe(false)
  })

  it('validates step2 requires at least one health goal', async () => {
    const { onboardingStep2Schema } = await import('@/lib/validators/onboarding')

    const valid = onboardingStep2Schema.safeParse({
      healthGoals: ['cognitive', 'metabolic'],
      primaryMotivation: 'Stay sharp and active',
      riskTolerance: 'medium',
    })
    expect(valid.success).toBe(true)

    const noGoals = onboardingStep2Schema.safeParse({
      healthGoals: [],
      primaryMotivation: 'Test',
      riskTolerance: 'low',
    })
    expect(noGoals.success).toBe(false)
  })

  it('validates step4 dietary and activity enums', async () => {
    const { onboardingStep4Schema } = await import('@/lib/validators/onboarding')

    const valid = onboardingStep4Schema.safeParse({
      dietaryPattern: 'mediterranean',
      activityLevel: 'active',
      sleepQuality: 4,
      stressLevel: 2,
    })
    expect(valid.success).toBe(true)

    const invalidDiet = onboardingStep4Schema.safeParse({
      dietaryPattern: 'carnivore',
      activityLevel: 'active',
      sleepQuality: 4,
      stressLevel: 2,
    })
    expect(invalidDiet.success).toBe(false)
  })

  it('validates complete schema with all steps', async () => {
    const { onboardingCompleteSchema } = await import('@/lib/validators/onboarding')

    const result = onboardingCompleteSchema.safeParse({
      step1: { dateOfBirth: '1985-03-20', biologicalSex: 'male' },
      step2: { healthGoals: ['cardiovascular'], primaryMotivation: 'Heart health', riskTolerance: 'low' },
      step3: { healthConditions: ['Hypertension'], supplementStack: ['CoQ10'] },
      step4: { dietaryPattern: 'omnivore', activityLevel: 'moderate', sleepQuality: 3, stressLevel: 3 },
    })
    expect(result.success).toBe(true)
  })
})
