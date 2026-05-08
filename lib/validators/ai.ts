import { z } from "zod"

export const aiQuerySchema = z.object({
  query: z.string().trim().min(10, "Query must be at least 10 characters"),
  context: z.string().trim().max(5000).optional(),
  maxResults: z.number().int().min(1).max(3).default(1),
})

export type AIQueryInput = z.infer<typeof aiQuerySchema>

export const aiCitationSchema = z.object({
  title: z.string().trim().min(1).max(500),
  source: z.string().trim().min(1).max(300),
  url: z.string().trim().url().max(2000).optional(),
})

export type AICitation = z.infer<typeof aiCitationSchema>

export const providerAIStructuredContentSchema = z.object({
  answer: z.string().trim().min(1, "Answer is required"),
  disclaimer: z.string().trim().min(1).optional(),
  citations: z.array(aiCitationSchema).max(10).default([]),
})

export type ProviderAIStructuredContent = z.infer<typeof providerAIStructuredContentSchema>

export const providerAIResponseSchema = z.object({
  content: z.string().trim().min(1),
  disclaimer: z.string().trim().min(1),
  disclaimers: z.array(z.string().trim().min(1)).min(1),
  citations: z.array(aiCitationSchema).max(10),
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  cost: z.number().nonnegative(),
  usage: z.unknown().optional(),
})

export type ProviderAIResponse = z.infer<typeof providerAIResponseSchema>

// ÆonForge Validators
export const aeonforgePromptSchema = z.object({
  prompt: z.string().trim().min(20, "Discovery prompt must be at least 20 characters").max(5000, "Prompt cannot exceed 5000 characters"),
  userContext: z.object({
    age: z.number().int().min(18).max(120).optional(),
    biomarkers: z.record(z.string(), z.number()).optional(),
    geneticsSummary: z.string().max(1000).optional(),
    healthHistory: z.string().max(2000).optional(),
    goals: z.array(z.string()).max(10).optional(),
  }).optional(),
  discoveryTier: z.enum(['explorer', 'pro', 'enterprise']).default('explorer'),
  includeSimulation: z.boolean().default(true),
  includeVirtualTwin: z.boolean().default(false),
})

export type AeonforgePromptInput = z.infer<typeof aeonforgePromptSchema>