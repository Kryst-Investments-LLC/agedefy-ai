import { z } from 'zod';

export const aiRequestSchema = z.object({
  query: z.string().min(1, 'Query is required').max(2000, 'Query too long'),
  context: z.string().optional(),
  maxResults: z.number().int().min(1).max(5).default(1)
});

export type AIRequestInput = z.infer<typeof aiRequestSchema>;

export const validateAIRequest = (data: unknown) => {
  return aiRequestSchema.safeParse(data);
};
