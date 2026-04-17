import { z } from 'zod'

export const medicationCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  dosage: z.string().trim().max(100).optional(),
  frequency: z.string().trim().max(100).optional(),
  prescribedFor: z.string().trim().max(300).optional(),
  category: z.enum(['supplement', 'prescription', 'otc']).default('supplement'),
  notes: z.string().trim().max(2000).optional(),
})

export type MedicationCreateInput = z.infer<typeof medicationCreateSchema>

export const medicationUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  dosage: z.string().trim().max(100).optional(),
  frequency: z.string().trim().max(100).optional(),
  prescribedFor: z.string().trim().max(300).optional(),
  category: z.enum(['supplement', 'prescription', 'otc']).optional(),
  active: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
})

export type MedicationUpdateInput = z.infer<typeof medicationUpdateSchema>
