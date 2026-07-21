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
import { authFailureCounter } from "@/lib/observability/telemetry"
import { getNonPasswordAuthHash, isLegacyEmptyPasswordHash, isPasswordLoginAllowed } from "@/lib/auth-password"
import { loginSchema } from "@/lib/validators/auth"
import { getMfaVerifiedAt, isMfaEnabled, isMfaRequired } from "@/lib/mfa"

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
        emailVerified: profile.email_verified === true,
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
          authFailureCounter.add(1, { reason: "invalid_payload" })
          return null
        }

        const user = await db.user.findUnique({
          where: { email: parsedCredentials.data.email.toLowerCase() },
        })

        if (!user) {
          authFailureCounter.add(1, { reason: "user_not_found" })
          return null
        }

        if (!isPasswordLoginAllowed(user.passwordHash)) {
          authFailureCounter.add(1, { reason: "password_login_disabled" })
          return null
        }

        const isValidPassword = await bcrypt.compare(parsedCredentials.data.password, user.passwordHash)

        if (!isValidPassword) {
          authFailureCounter.add(1, { reason: "invalid_password" })
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
        // Refuse SSO sign-in if the IdP did not assert a verified email.
        // Without this an attacker controlling an unverified mailbox claim
        // could impersonate (or auto-promote to admin via configured admin emails).
        const emailVerified = (user as unknown as { emailVerified?: boolean }).emailVerified === true
        if (!emailVerified) {
          return false
        }
        const existing = await db.user.findUnique({ where: { email: user.email.toLowerCase() } })
        if (!existing) {
          // Never auto-promote to ADMIN on first SSO sign-in. Admins must be
          // bootstrapped through an explicit credentialed login or a manual
          // role assignment. This closes the OIDC admin-by-email risk.
          await db.user.create({
            data: {
              email: user.email.toLowerCase(),
              name: user.name || undefined,
              passwordHash: getNonPasswordAuthHash("OIDC"),
              role: UserRole.MEMBER,
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
    async jwt({ token, user, trigger: _trigger, account }) {
      if (user) {
        // For OIDC logins, resolve the user from the DB to get our internal ID
        if (account?.provider === "oidc" && user.email) {
          const dbUser = await db.user.findUnique({ where: { email: user.email.toLowerCase() } })
          if (dbUser) {
            token.sub = dbUser.id
            token.role = dbUser.role
            token.tenantId = dbUser.defaultTenantId ?? getFallbackTenantId()
            token.loginAt = Date.now()
            token.mfaPending = await isMfaEnabled(dbUser.id) || isMfaRequired(dbUser.role)
            return token
          }
        }
        token.sub = user.id
        token.role = user.role ?? UserRole.MEMBER
        token.tenantId = user.tenantId ?? getFallbackTenantId()
        token.organizationId = user.organizationId
        token.loginAt = Date.now()
        token.mfaPending = (user as unknown as Record<string, unknown>).mfaPending === true
      }

      // Server-authoritative MFA clear. The gate is lowered ONLY when the DB
      // shows a second-factor challenge that was recorded AFTER this session's
      // login epoch (token.loginAt). Nothing here trusts the update() payload,
      // so a client cannot bypass MFA by calling update({ mfaPending: false }).
      // Runs on every refresh while pending (cheap: one indexed lookup, and it
      // stops once cleared).
      if (token.mfaPending && token.sub) {
        const loginEpoch =
          typeof token.loginAt === "number"
            ? token.loginAt
            : typeof token.iat === "number"
              ? token.iat * 1000
              : 0
        const verifiedAt = await getMfaVerifiedAt(token.sub as string)
        if (verifiedAt && verifiedAt.getTime() >= loginEpoch) {
          token.mfaPending = false
        }
      }

      // Re-evaluate role + mfaPending on every JWT refresh, not only at sign-in.
      // Without this, a user promoted to ADMIN/CLINICIAN while holding a session
      // would skip MFA gating until their next login.
      if (token.sub && !user) {
        const dbUser = await db.user.findUnique({
          where: { id: token.sub as string },
          select: { role: true, defaultTenantId: true },
        })
        if (dbUser) {
          const previousRole = token.role
          token.role = dbUser.role
          if (!token.tenantId) {
            token.tenantId = dbUser.defaultTenantId ?? getFallbackTenantId()
          }
          if (previousRole !== dbUser.role && isMfaRequired(dbUser.role)) {
            const enrolled = await isMfaEnabled(token.sub as string)
            token.mfaPending = enrolled || true
            // New privilege → new auth epoch: a verification recorded before
            // this elevation must not satisfy the re-raised gate.
            token.loginAt = Date.now()
          }
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
