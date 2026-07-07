import { UserRole } from "@prisma/client"
import { authenticator } from "otplib"
import * as QRCode from "qrcode"
import crypto from "crypto"

import { db } from "@/lib/db"
import { encryptMfaSecret, readStoredMfaSecret } from "@/lib/mfa-crypto"

const MFA_ISSUER = "Biozephyra"
const BACKUP_CODE_COUNT = 10

// ---------------------------------------------------------------------------
// Role gating
// ---------------------------------------------------------------------------

const MFA_REQUIRED_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.ADMIN,
  UserRole.CLINICIAN,
])

export function isMfaRequired(role: UserRole): boolean {
  return MFA_REQUIRED_ROLES.has(role)
}

export async function isMfaEnabled(userId: string): Promise<boolean> {
  const record = await db.userMfaSecret.findUnique({
    where: { userId },
    select: { verified: true },
  })
  return record?.verified === true
}

// ---------------------------------------------------------------------------
// Server-authoritative verification marker
//
// The MFA gate (token.mfaPending) is lowered by the JWT callback ONLY when the
// DB shows a verification recorded after the current session's login. The
// client cannot clear the gate by passing data to NextAuth's update() — the
// server is the sole source of truth. `recordMfaVerification` is the write side
// (called by the verify endpoint on a successful challenge); `getMfaVerifiedAt`
// is the read side used by the callback.
// ---------------------------------------------------------------------------

export async function recordMfaVerification(userId: string): Promise<void> {
  await db.userMfaSecret.updateMany({
    where: { userId },
    data: { lastVerifiedAt: new Date() },
  })
}

export async function getMfaVerifiedAt(userId: string): Promise<Date | null> {
  const record = await db.userMfaSecret.findUnique({
    where: { userId },
    select: { lastVerifiedAt: true },
  })
  return record?.lastVerifiedAt ?? null
}

// ---------------------------------------------------------------------------
// Secret + QR generation
// ---------------------------------------------------------------------------

function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(4).toString("hex"), // 8-char hex codes
  )
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex")
}

export async function generateMfaSecret(userId: string, email: string) {
  const secret = authenticator.generateSecret()
  const otpAuthUrl = authenticator.keyuri(email, MFA_ISSUER, secret)
  const qrCodeDataUri = await QRCode.toDataURL(otpAuthUrl)
  const backupCodes = generateBackupCodes()
  const hashedBackupCodes = backupCodes.map(hashCode)
  const encryptedSecret = encryptMfaSecret(secret)

  await db.userMfaSecret.upsert({
    where: { userId },
    update: { secret: encryptedSecret, verified: false, backupCodes: hashedBackupCodes },
    create: { userId, secret: encryptedSecret, verified: false, backupCodes: hashedBackupCodes },
  })

  return { qrCodeDataUri, secret, backupCodes }
}

// ---------------------------------------------------------------------------
// TOTP verification
// ---------------------------------------------------------------------------

export async function verifyMfaToken(userId: string, token: string): Promise<boolean> {
  const record = await db.userMfaSecret.findUnique({
    where: { userId },
  })

  if (!record) {
    return false
  }

  const plaintextSecret = readStoredMfaSecret(record.secret)
  return authenticator.check(token, plaintextSecret)
}

// ---------------------------------------------------------------------------
// Backup code verification (single-use)
// ---------------------------------------------------------------------------

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const record = await db.userMfaSecret.findUnique({
    where: { userId },
  })

  if (!record || !Array.isArray(record.backupCodes)) {
    return false
  }

  const hashed = hashCode(code)
  const codes = record.backupCodes as string[]
  const idx = codes.indexOf(hashed)

  if (idx === -1) {
    return false
  }

  // Consume the backup code
  const remaining = [...codes]
  remaining.splice(idx, 1)
  await db.userMfaSecret.update({
    where: { userId },
    data: { backupCodes: remaining },
  })

  return true
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export async function activateMfa(userId: string, token: string): Promise<boolean> {
  const isValid = await verifyMfaToken(userId, token)
  if (!isValid) {
    return false
  }

  await db.userMfaSecret.update({
    where: { userId },
    data: { verified: true },
  })

  return true
}

// ---------------------------------------------------------------------------
// Disable MFA
// ---------------------------------------------------------------------------

export async function disableMfa(userId: string, token: string): Promise<boolean> {
  const isValid = await verifyMfaToken(userId, token)
  if (!isValid) {
    // Try backup code
    const backupValid = await verifyBackupCode(userId, token)
    if (!backupValid) {
      return false
    }
  }

  await db.userMfaSecret.delete({
    where: { userId },
  })

  return true
}
