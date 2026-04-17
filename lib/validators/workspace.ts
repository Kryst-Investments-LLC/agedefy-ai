import { SubscriptionStatus } from "@prisma/client"
import { z } from "zod"

export const biomarkerSchema = z.object({
  name: z.string().trim().min(2, "Biomarker name is required"),
  value: z.coerce.number().finite("Value must be a valid number"),
  unit: z.string().trim().min(1, "Unit is required"),
  target: z
    .union([z.coerce.number().finite("Target must be a valid number"), z.literal(""), z.undefined()])
    .transform((value) => (value === "" || typeof value === "undefined" ? undefined : value)),
  trend: z.enum(["UP", "DOWN", "STABLE"]).default("STABLE"),
  measuredAt: z.string().datetime().optional(),
  protocolId: z.string().min(1).optional(),
})

export const protocolSchema = z.object({
  name: z.string().trim().min(3, "Protocol name is required"),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
  contraindicationScore: z.coerce.number().min(0).max(1).optional(),
})

export const profileSchema = z.object({
  longevityGoal: z.string().trim().max(200).optional(),
  riskTolerance: z.enum(["low", "medium", "high"]).optional(),
})

export const consentScopeSchema = z.object({
  resource: z.enum(["biomarkers", "labs", "wearables", "protocols", "outcomes", "clinical-notes", "research", "integrations"]),
  permission: z.enum(["read", "write", "share", "train-models", "export"]),
})

/** GDPR Article 6 consent categories required before using Biozephyra features */
export const GDPR_CONSENT_CATEGORIES = [
  "data-processing",
  "ai-health-info",
  "research-usage",
] as const
export type GdprConsentCategory = (typeof GDPR_CONSENT_CATEGORIES)[number]

export const gdprConsentSchema = z.object({
  category: z.enum(GDPR_CONSENT_CATEGORIES),
  granted: z.boolean(),
  grantedAt: z.string().datetime().optional(),
})

export const consentMutationSchema = z.object({
  scopes: z.array(consentScopeSchema).min(1).max(50),
  gdprConsents: z.array(gdprConsentSchema).optional(),
  legalBasis: z.enum(["explicit-consent", "treatment", "operations", "research"]).optional(),
  effectiveAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  policyVersion: z.string().trim().max(120).optional(),
  consentVersion: z.number().int().min(1).optional(),
  status: z.enum(["active", "revoked"]).default("active"),
  revocationReason: z.string().trim().max(500).optional(),
}).refine((value) => value.status !== "revoked" || Boolean(value.revocationReason), {
  message: "Revocation reason is required when revoking consent",
  path: ["revocationReason"],
})

export const subscriptionSchema = z.object({
  plan: z.string().trim().min(2, "Plan name is required"),
  status: z.nativeEnum(SubscriptionStatus),
  priceCents: z.coerce.number().int().min(0, "Price must be zero or greater"),
  currency: z.string().trim().length(3, "Currency must be a 3-letter ISO code").default("USD"),
  billingCycle: z.enum(["monthly", "yearly", "custom"]),
  monthlyAICreditAllowance: z.coerce.number().int().min(0, "Monthly AI allowance must be zero or greater").optional(),
  currentPeriodEnd: z.string().datetime().optional(),
})