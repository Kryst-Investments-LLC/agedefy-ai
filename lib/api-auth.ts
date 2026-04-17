import type { NextRequest } from "next/server"
import { decode, getToken } from "next-auth/jwt"

import { env } from "@/lib/env"

export async function getApiRequestUserId(req: NextRequest) {
  const secret = env.NEXTAUTH_SECRET

  const cookieToken = await getToken({ req, secret })
  if (typeof cookieToken?.sub === "string") {
    return cookieToken.sub
  }

  const authorization = req.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) {
    return null
  }

  const decoded = await decode({
    token: authorization.slice("Bearer ".length),
    secret,
  })

  return typeof decoded?.sub === "string" ? decoded.sub : null
}