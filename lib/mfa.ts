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
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    // 80 bits of entropy (was 32). Grouped as XXXXX-XXXXX-XXXXX-XXXXX for
    // readability; the separators/case are cosmetic — hashCode normalizes them
    // away, so what the user types back is matched regardless of formatting.
    const raw = crypto.randomBytes(10).toString("hex")
    return (raw.match(/.{1,5}/g) ?? [raw]).join("-").toUpperCase()
  })
}

// Strip formatting so a code entered as "abcde-fghij" matches one stored from
// "ABCDEFGHIJ". Legacy 8-char hex codes are unaffected (already normalized),
// so previously issued backup codes keep working.
function normalizeCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
}

// SHA-256 is the right primitive for high-entropy random tokens (same as this
// schema's ActiveSession.tokenHash). With ≥80-bit codes it is not offline-
// brute-forceable, and a deterministic hash is what lets verifyBackupCode
// consume atomically (see below).
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(normalizeCode(code)).digest("hex")
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
  const hashed = hashCode(code)

  // Atomic single-use consume. A single UPDATE removes the hash from the jsonb
  // array only while it is still present (`@>`). Under concurrency Postgres
  // takes a row lock and re-evaluates the WHERE against the committed row, so a
  // second request racing with the same code matches zero rows — closing the
  // read-modify-write TOCTOU that previously let one backup code be spent twice.
  const affected = await db.$executeRaw`
    UPDATE "UserMfaSecret"
    SET "backupCodes" = "backupCodes" - ${hashed}::text
    WHERE "userId" = ${userId}
      AND "backupCodes" @> ${JSON.stringify([hashed])}::jsonb
  `

  return affected === 1
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
