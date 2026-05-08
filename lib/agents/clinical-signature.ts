import { createHash } from 'crypto'

import { logAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export type SignatureInput = {
  reviewItemId: string
  sessionId?: string
  clinicianId: string
  clinicianName: string
  clinicianEmail: string
  tenantId: string
  rationale: string
  compoundName?: string
  riskCategory?: string
}

export type ClinicalSignatureRecord = {
  id: string
  reviewItemId: string
  sessionId: string | null
  clinicianId: string
  clinicianName: string
  clinicianEmail: string
  rationale: string
  compoundName: string | null
  riskCategory: string | null
  signatureHash: string
  signedAt: string
}

/**
 * Generates a SHA-256 signature hash from the signing context.
 * This creates a tamper-evident fingerprint of the approval action.
 */
function generateSignatureHash(
  clinicianId: string,
  reviewItemId: string,
  rationale: string,
  timestamp: string,
): string {
  const payload = [clinicianId, reviewItemId, rationale, timestamp].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

/**
 * Creates a clinical signature for a RED-tier review item approval.
 * The signature binds the clinician's identity, rationale, and timestamp
 * into a tamper-evident record.
 */
export async function createClinicalSignature(
  input: SignatureInput,
): Promise<ClinicalSignatureRecord> {
  const signedAt = new Date()
  const signatureHash = generateSignatureHash(
    input.clinicianId,
    input.reviewItemId,
    input.rationale,
    signedAt.toISOString(),
  )

  const signature = await db.clinicalSignature.create({
    data: {
      reviewItemId: input.reviewItemId,
      sessionId: input.sessionId,
      clinicianId: input.clinicianId,
      tenantId: input.tenantId,
      rationale: input.rationale,
      compoundName: input.compoundName,
      riskCategory: input.riskCategory,
      signatureHash,
      signedAt,
      clinicianName: input.clinicianName,
      clinicianEmail: input.clinicianEmail,
    },
  })

  await logAudit({
    actorUserId: input.clinicianId,
    tenantId: input.tenantId,
    action: 'clinician.red_tier_signature',
    entityType: 'ClinicalSignature',
    entityId: signature.id,
    details: {
      reviewItemId: input.reviewItemId,
      sessionId: input.sessionId,
      compoundName: input.compoundName,
      riskCategory: input.riskCategory,
      signatureHash,
    },
  })

  logger.info('Clinical signature created', {
    signatureId: signature.id,
    clinicianId: input.clinicianId,
    reviewItemId: input.reviewItemId,
    compoundName: input.compoundName,
  })

  return {
    id: signature.id,
    reviewItemId: signature.reviewItemId,
    sessionId: signature.sessionId,
    clinicianId: signature.clinicianId,
    clinicianName: signature.clinicianName,
    clinicianEmail: signature.clinicianEmail,
    rationale: signature.rationale,
    compoundName: signature.compoundName,
    riskCategory: signature.riskCategory,
    signatureHash: signature.signatureHash,
    signedAt: signature.signedAt.toISOString(),
  }
}

/**
 * Fetches all clinical signatures for a given agent session.
 */
export async function getSessionSignatures(
  sessionId: string,
): Promise<ClinicalSignatureRecord[]> {
  const signatures = await db.clinicalSignature.findMany({
    where: { sessionId },
    orderBy: { signedAt: 'asc' },
  })

  return signatures.map((s) => ({
    id: s.id,
    reviewItemId: s.reviewItemId,
    sessionId: s.sessionId,
    clinicianId: s.clinicianId,
    clinicianName: s.clinicianName,
    clinicianEmail: s.clinicianEmail,
    rationale: s.rationale,
    compoundName: s.compoundName,
    riskCategory: s.riskCategory,
    signatureHash: s.signatureHash,
    signedAt: s.signedAt.toISOString(),
  }))
}

/**
 * Checks if a specific review item has been clinically signed.
 */
export async function hasSignature(reviewItemId: string): Promise<boolean> {
  const count = await db.clinicalSignature.count({
    where: { reviewItemId },
  })
  return count > 0
}
