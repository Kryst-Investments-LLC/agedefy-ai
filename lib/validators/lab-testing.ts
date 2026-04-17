import { z } from "zod"

export const labResultEntrySchema = z.object({
  biomarkerName: z.string().trim().min(1).max(200),
  value: z.coerce.number().finite(),
  unit: z.string().trim().min(1).max(50),
  refLow: z.coerce.number().finite().optional(),
  refHigh: z.coerce.number().finite().optional(),
  flag: z.string().trim().max(120).optional(),
  protocolId: z.string().min(1).optional(),
})

export const labResultMutationSchema = z.object({
  orderId: z.string().min(1),
  completedAt: z.string().datetime().optional(),
  results: z.array(labResultEntrySchema).min(1).max(200),
})