import { z } from "zod"

export const researchIngestSchema = z.object({
  collectionName: z.string().min(1).max(200),
  query: z.string().min(2).max(500),
  maxResults: z.number().int().min(1).max(50).optional().default(10),
})

export const clinicianTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  priority: z.number().int().min(0).max(5).optional().default(0),
  dueAt: z.string().datetime().optional(),
})

export const clinicianTaskUpdateSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELED"]).optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional(),
  priority: z.number().int().min(0).max(5).optional(),
})

export const partnerDataSchema = z.object({
  source: z.enum(["LAB", "WEARABLE", "GENOMICS", "CUSTOM"]),
  partnerId: z.string().max(200).optional(),
  label: z.string().min(1).max(300),
  payload: z.string().min(1).max(50000),
})

export const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  actorEmail: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export const orchestrationJobAdminQuerySchema = z.object({
  queue: z.enum(["AI", "INGESTION", "NOTIFICATION", "GOVERNANCE"]).optional(),
  status: z.enum(["QUEUED", "LEASED", "SUCCEEDED", "FAILED", "DEAD_LETTER", "CANCELED"]).optional(),
  jobType: z.string().min(1).max(120).optional(),
  cursor: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(25),
})
