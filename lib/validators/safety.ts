import { z } from "zod"

const adverseEventSeverity = ["mild", "moderate", "severe", "life-threatening"] as const
const adverseEventSeriousness = [
  "non-serious",
  "hospitalization",
  "disability",
  "medically-significant",
  "death",
] as const
const adverseEventCategory = ["symptom", "lab-abnormality", "interaction", "allergy", "device-issue", "other"] as const
const adverseEventDetectedBy = ["user", "clinician", "system", "integration"] as const
const adverseEventOutcome = ["resolved", "resolving", "persistent", "fatal", "unknown"] as const

export const adverseEventMutationSchema = z.object({
  protocolId: z.string().min(1).optional(),
  severity: z.enum(adverseEventSeverity),
  seriousness: z.enum(adverseEventSeriousness),
  category: z.enum(adverseEventCategory),
  suspectedCause: z.string().trim().max(500).optional(),
  symptoms: z.array(z.string().trim().min(1).max(200)).min(1).max(30),
  detectedBy: z.enum(adverseEventDetectedBy),
  onsetAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  outcome: z.enum(adverseEventOutcome).optional(),
  escalationRequired: z.boolean().default(false),
  regulatorReportable: z.boolean().optional().default(false),
  note: z.string().trim().max(2000).optional(),
})

export const adverseEventUpdateSchema = adverseEventMutationSchema.partial().extend({
  id: z.string().min(1),
}).refine((value) => Object.keys(value).some((key) => key !== "id"), {
  message: "At least one adverse event field must be updated",
})