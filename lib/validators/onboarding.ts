import { z } from 'zod'

export const onboardingStep1Schema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format: YYYY-MM-DD'),
  biologicalSex: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
})

export const onboardingStep2Schema = z.object({
  healthGoals: z
    .array(z.enum(['cognitive', 'cardiovascular', 'metabolic', 'athletic', 'aesthetic', 'sleep', 'hormonal', 'immune']))
    .min(1, 'Select at least one health goal')
    .max(5),
  primaryMotivation: z.string().trim().min(3).max(300),
  riskTolerance: z.enum(['low', 'medium', 'high']),
})

export const onboardingStep3Schema = z.object({
  healthConditions: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  supplementStack: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
})

export const onboardingStep4Schema = z.object({
  dietaryPattern: z.enum([
    'omnivore', 'vegetarian', 'vegan', 'keto', 'mediterranean', 'paleo', 'other',
  ]),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  sleepQuality: z.number().int().min(1).max(5),
  stressLevel: z.number().int().min(1).max(5),
})

// Explicit, granular consent captured at onboarding — the point where health
// data collection begins. data-processing is REQUIRED to proceed (lawful basis
// for processing special-category health data); ai-health-info is optional.
export const onboardingConsentSchema = z.object({
  dataProcessing: z.literal(true, {
    errorMap: () => ({ message: "You must consent to health-data processing to continue" }),
  }),
  aiHealthInfo: z.boolean().default(false),
  policyVersion: z.string().min(1).max(50).optional(),
})

export const onboardingCompleteSchema = z.object({
  step1: onboardingStep1Schema,
  step2: onboardingStep2Schema,
  step3: onboardingStep3Schema,
  step4: onboardingStep4Schema,
  consent: onboardingConsentSchema,
})

export type OnboardingData = z.infer<typeof onboardingCompleteSchema>
