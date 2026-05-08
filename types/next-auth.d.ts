import type { DefaultSession } from "next-auth"
import type { UserRole } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role: UserRole
      tenantId: string
      organizationId?: string
    }
  }

  interface User {
    role?: UserRole
    tenantId?: string
    organizationId?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole
    sub?: string
    tenantId?: string
    organizationId?: string
    mfaPending?: boolean
  }
}