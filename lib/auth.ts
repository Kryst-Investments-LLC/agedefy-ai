import { PrismaAdapter } from "@auth/prisma-adapter"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import type { NextAuthOptions } from "next-auth"
import NextAuth from "next-auth"
import type { Provider } from "next-auth/providers/index"
import CredentialsProvider from "next-auth/providers/credentials"

import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { getFallbackTenantId, resolveStoredTenantContextForUser } from "@/lib/tenancy"
import { isConfiguredAdminEmail } from "@/lib/admin"
import { getNonPasswordAuthHash, isLegacyEmptyPasswordHash, isPasswordLoginAllowed } from "@/lib/auth-password"
import { loginSchema } from "@/lib/validators/auth"
import { isMfaEnabled, isMfaRequired } from "@/lib/mfa"

// ---------------------------------------------------------------------------
// OIDC SSO Provider (optional)
// ---------------------------------------------------------------------------
function buildOidcProvider(): Provider | null {
  const ssoEnabled = process.env.SSO_ENABLED === "true"
  const issuer = process.env.SSO_ISSUER
  const clientId = process.env.SSO_CLIENT_ID
  const clientSecret = process.env.SSO_CLIENT_SECRET

  if (!ssoEnabled || !issuer || !clientId || !clientSecret) return null

  return {
    id: "oidc",
    name: "Enterprise SSO",
    type: "oauth",
    wellKnown: `${issuer}/.well-known/openid-configuration`,
    clientId,
    clientSecret,
    authorization: { params: { scope: "openid email profile" } },
    idToken: true,
    checks: ["pkce", "state"],
    profile(profile: Record<string, unknown>) {
      return {
        id: profile.sub as string,
        name: (profile.name as string) ?? (profile.preferred_username as string) ?? null,
        email: (profile.email as string) ?? null,
        image: (profile.picture as string) ?? null,
      }
    },
  }
}

const oidcProvider = buildOidcProvider()

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    ...(oidcProvider ? [oidcProvider] : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = loginSchema.safeParse(credentials)

        if (!parsedCredentials.success) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: parsedCredentials.data.email.toLowerCase() },
        })

        if (!user) {
          return null
        }

        if (!isPasswordLoginAllowed(user.passwordHash)) {
          return null
        }

        const isValidPassword = await bcrypt.compare(parsedCredentials.data.password, user.passwordHash)

        if (!isValidPassword) {
          return null
        }

        const shouldBeAdmin = isConfiguredAdminEmail(user.email)
        const role = shouldBeAdmin ? UserRole.ADMIN : user.role

        if (role !== user.role) {
          await db.user.update({
            where: { id: user.id },
            data: { role },
          })
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
          tenantId: user.defaultTenantId ?? getFallbackTenantId(),
          // MFA pending if user has MFA enabled (needs verification) OR if
          // role requires MFA but user hasn't enrolled yet (needs setup)
          mfaPending: await isMfaEnabled(user.id) || isMfaRequired(role),
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Auto-create user record for SSO (OIDC) logins on first sign-in
      if (account?.provider === "oidc" && user.email) {
        const existing = await db.user.findUnique({ where: { email: user.email.toLowerCase() } })
        if (!existing) {
          const shouldBeAdmin = isConfiguredAdminEmail(user.email)
          await db.user.create({
            data: {
              email: user.email.toLowerCase(),
              name: user.name || undefined,
              passwordHash: getNonPasswordAuthHash("OIDC"),
              role: shouldBeAdmin ? UserRole.ADMIN : UserRole.MEMBER,
              defaultTenantId: getFallbackTenantId(),
            },
          })
        } else if (isLegacyEmptyPasswordHash(existing.passwordHash)) {
          await db.user.update({
            where: { id: existing.id },
            data: { passwordHash: getNonPasswordAuthHash("OIDC") },
          })
        }
      }
      return true
    },
    async jwt({ token, user, trigger, account }) {
      if (user) {
        // For OIDC logins, resolve the user from the DB to get our internal ID
        if (account?.provider === "oidc" && user.email) {
          const dbUser = await db.user.findUnique({ where: { email: user.email.toLowerCase() } })
          if (dbUser) {
            token.sub = dbUser.id
            token.role = dbUser.role
            token.tenantId = dbUser.defaultTenantId ?? getFallbackTenantId()
            token.mfaPending = await isMfaEnabled(dbUser.id) || isMfaRequired(dbUser.role)
            return token
          }
        }
        token.sub = user.id
        token.role = user.role ?? UserRole.MEMBER
        token.tenantId = user.tenantId ?? getFallbackTenantId()
        token.organizationId = user.organizationId
        token.mfaPending = (user as unknown as Record<string, unknown>).mfaPending === true
      }

      // Allow MFA verification endpoint and MFA setup to clear mfaPending
      if (trigger === "update" && token.mfaPending) {
        // The verify/setup endpoint triggers a session update with mfaPending=false
        const updatePayload = user as unknown as Record<string, unknown> | undefined
        if (updatePayload?.mfaPending === false) {
          token.mfaPending = false
        }
      }

      if (token.sub && (!token.tenantId || token.organizationId === undefined)) {
        const tenantContext = await resolveStoredTenantContextForUser(token.sub)
        token.tenantId = token.tenantId ?? tenantContext.tenantId
        token.organizationId = token.organizationId ?? tenantContext.organizationId
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        session.user.role = token.role ?? UserRole.MEMBER
        session.user.tenantId = token.tenantId ?? getFallbackTenantId()
        session.user.organizationId = token.organizationId
        ;(session as unknown as Record<string, unknown>).mfaPending = token.mfaPending === true
      }

      return session
    },
  },
  secret: env.NEXTAUTH_SECRET,
}

export const authHandler = NextAuth(authOptions)