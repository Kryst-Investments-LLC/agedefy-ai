import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import type { GdprConsentCategory } from '@/lib/validators/workspace'
import { GDPR_CONSENT_CATEGORIES } from '@/lib/validators/workspace'

interface GdprConsentEntry {
  category: string
  granted: boolean
  grantedAt?: string | null
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
