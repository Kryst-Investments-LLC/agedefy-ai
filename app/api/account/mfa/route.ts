import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { generateMfaSecret, activateMfa, disableMfa, isMfaEnabled } from "@/lib/mfa"

// POST — Generate new MFA secret, return QR code
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const alreadyEnabled = await isMfaEnabled(session.user.id)
  if (alreadyEnabled) {
    return NextResponse.json({ error: "MFA is already enabled" }, { status: 409 })
  }

  const result = await generateMfaSecret(session.user.id, session.user.email!)
  return NextResponse.json({
    qrCodeDataUri: result.qrCodeDataUri,
    secret: result.secret,
    backupCodes: result.backupCodes,
  })
}

// PUT — Verify and activate MFA with a valid TOTP token
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const token = typeof body?.token === "string" ? body.token.trim() : ""
  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: "Token must be a 6-digit code" }, { status: 400 })
  }

  const activated = await activateMfa(session.user.id, token)
  if (!activated) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 })
  }

  return NextResponse.json({ enabled: true })
}

// DELETE — Disable MFA (requires current TOTP token or backup code)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const token = typeof body?.token === "string" ? body.token.trim() : ""
  if (!token) {
    return NextResponse.json({ error: "Token or backup code is required" }, { status: 400 })
  }

  const disabled = await disableMfa(session.user.id, token)
  if (!disabled) {
    return NextResponse.json({ error: "Invalid token or backup code" }, { status: 403 })
  }

  return NextResponse.json({ enabled: false })
}
