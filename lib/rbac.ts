import type { Session } from "next-auth"
import { NextResponse } from "next/server"

import type { UserRole } from "@prisma/client"

type AuthedSession = Session & { user: Session["user"] & { id: string } }

/**
 * Returns a 401 JSON response if the session is missing or the user has no id.
 * On success returns the narrowed session with a guaranteed `user.id`.
 */
export function requireAuth(session: Session | null): NextResponse | AuthedSession {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return session as AuthedSession
}

/**
 * Returns a 403 JSON response if the session user does not hold one of the
 * specified roles.  Callers should first ensure the user is authenticated
 * (e.g. via `requireAuth`).
 */
export function requireRole(session: Session | null, ...roles: UserRole[]): NextResponse | null {
  const userRole = session?.user?.role as UserRole | undefined
  if (!userRole || !roles.includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/**
 * Combined auth + role check. Returns either a 401/403 response or the
 * narrowed authenticated session.
 */
export function requireAuthWithRole(session: Session | null, ...roles: UserRole[]): NextResponse | AuthedSession {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userRole = session.user.role as UserRole | undefined
  if (!userRole || !roles.includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return session as AuthedSession
}
