import { z } from "zod"

export const consultationRequestSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
  type: z.enum(["INITIAL", "FOLLOW_UP", "LAB_REVIEW", "PROTOCOL_REVIEW"]),
  providerId: z.string().min(1).optional(),
  notes: z.string().trim().max(500).optional(),
})

export const consultationLifecycleUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELED"]),
  scheduledAt: z.string().datetime().optional(),
  summary: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((value, ctx) => {
  if (value.status === "SCHEDULED" && !value.scheduledAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scheduledAt"],
      message: "scheduledAt is required when scheduling a consultation",
    })
  }

  if (value.status === "COMPLETED" && !value.summary) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["summary"],
      message: "summary is required when completing a consultation",
    })
  }
})

export const consultationCancelSchema = z.object({
  id: z.string().min(1),
})

export const consultationScheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
})

export const consultationStartSchema = z.object({
  notes: z.string().trim().max(500).optional(),
})

export const consultationCompleteSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  notes: z.string().trim().max(500).optional(),
})