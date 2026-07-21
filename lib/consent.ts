import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import type { GdprConsentCategory } from '@/lib/validators/workspace'
import { GDPR_CONSENT_CATEGORIES } from '@/lib/validators/workspace'

interface GdprConsentEntry {
  category: string
  granted: boolean
  grantedAt?: string | null
}

// A minimal Prisma-like surface so callers can pass either the base client or a
// transaction client (for recording consent atomically with another write).
type ConsentGrantClient = {
  userConsentGrant: {
    findUnique: (typeof db.userConsentGrant)["findUnique"]
    upsert: (typeof db.userConsentGrant)["upsert"]
  }
}

/**
 * Grant (or re-affirm) the given GDPR consent categories for a user. Single
 * source of truth for writing a consent grant — used by the /api/consent route,
 * the onboarding flow, and the backfill script so the three can never diverge.
 * Merges with any existing entries, preserving prior grantedAt timestamps, and
 * bumps consentVersion on update. Pass `client` (a transaction client) to make
 * the grant atomic with a sibling write.
 */
export async function grantGdprConsents(
  userId: string,
  categories: readonly GdprConsentCategory[],
  opts: { legalBasis?: string; policyVersion?: string; client?: ConsentGrantClient } = {},
) {
  const client = opts.client ?? db
  const existing = await client.userConsentGrant.findUnique({ where: { userId } })
  const existingEntries =
    (existing?.gdprConsents as unknown as Array<{ category: string; granted: boolean; grantedAt?: string }>) ?? []
  const now = new Date().toISOString()

  const mergedEntries = GDPR_CONSENT_CATEGORIES.map((cat) => {
    const isGranted = categories.includes(cat)
    const prev = existingEntries.find((e) => e.category === cat)
    if (isGranted) {
      return { category: cat, granted: true, grantedAt: prev?.granted ? (prev.grantedAt ?? now) : now }
    }
    return prev ?? { category: cat, granted: false }
  })

  return client.userConsentGrant.upsert({
    where: { userId },
    create: {
      userId,
      status: "active",
      legalBasis: opts.legalBasis ?? "explicit-consent",
      scopes: [...categories],
      gdprConsents: mergedEntries,
      policyVersion: opts.policyVersion ?? "1.0",
    },
    update: {
      status: "active",
      gdprConsents: mergedEntries,
      consentVersion: { increment: 1 },
      revokedAt: null,
      revocationReason: null,
      ...(opts.legalBasis ? { legalBasis: opts.legalBasis } : {}),
      ...(opts.policyVersion ? { policyVersion: opts.policyVersion } : {}),
    },
  })
}

/**
 * Check whether a user has granted a specific GDPR consent category.
 * Returns `true` only when the user has an active consent grant with
 * the requested category marked as `granted: true`.
 */
export async function hasGdprConsent(
  userId: string,
  category: GdprConsentCategory,
): Promise<boolean> {
  const consent = await db.userConsentGrant.findUnique({
    where: { userId },
    select: { status: true, gdprConsents: true },
  })

  if (!consent || consent.status !== 'active') return false
  if (!consent.gdprConsents || !Array.isArray(consent.gdprConsents)) return false

  const entries = consent.gdprConsents as unknown as GdprConsentEntry[]
  const entry = entries.find((e) => e.category === category)
  return entry?.granted === true
}

/**
 * Check whether a user has granted ALL required GDPR consent categories.
 */
export async function hasAllGdprConsents(
  userId: string,
  categories: readonly GdprConsentCategory[] = GDPR_CONSENT_CATEGORIES,
): Promise<boolean> {
  const consent = await db.userConsentGrant.findUnique({
    where: { userId },
    select: { status: true, gdprConsents: true },
  })

  if (!consent || consent.status !== 'active') return false
  if (!consent.gdprConsents || !Array.isArray(consent.gdprConsents)) return false

  const entries = consent.gdprConsents as unknown as GdprConsentEntry[]
  return categories.every((cat) => {
    const entry = entries.find((e) => e.category === cat)
    return entry?.granted === true
  })
}

/**
 * Route-level guard that returns a 403 response if the user has not granted
 * the required GDPR consent categories. Returns `null` when consent is satisfied.
 *
 * Usage in a route handler:
 * ```ts
 * const blocked = await requireGdprConsent(session.user.id, ['ai-health-info'])
 * if (blocked) return blocked
 * ```
 */
export async function requireGdprConsent(
  userId: string,
  categories: readonly GdprConsentCategory[],
): Promise<NextResponse | null> {
  const satisfied = await hasAllGdprConsents(userId, categories)
  if (satisfied) return null

  return NextResponse.json(
    {
      error: 'Consent required',
      code: 'CONSENT_REQUIRED',
      requiredCategories: categories,
      message: 'You must grant the required consents before using this feature. Visit /account/consent to update your preferences.',
    },
    { status: 403 },
  )
}
