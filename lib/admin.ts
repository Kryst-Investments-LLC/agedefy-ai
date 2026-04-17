import { UserRole } from "@prisma/client"

import { env } from "@/lib/env"

export function getAdminEmails() {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isConfiguredAdminEmail(email: string) {
  return getAdminEmails().includes(email.toLowerCase())
}

export function isAdminRole(role: UserRole | undefined) {
  return role === UserRole.ADMIN
}