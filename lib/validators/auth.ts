import { z } from "zod"

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("A valid email address is required"),
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: z.string().trim().email("A valid email address is required"),
  password: z.string().min(1, "Password is required"),
})