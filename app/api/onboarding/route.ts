import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { grantGdprConsents } from '@/lib/consent'
import { applyRateLimit } from '@/lib/rate-limit'
import { processReferralReward } from '@/lib/sharing/referral-reward'
import { onboardingCompleteSchema } from '@/lib/validators/onboarding'
import type { GdprConsentCategory } from '@/lib/validators/workspace'

/**
 * POST /api/onboarding
 *
 * Persist onboarding answers to UserProfile.
 */
export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = onboardingCompleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { step1, step2, step3, step4, consent } = parsed.data

  // data-processing is mandatory (enforced by the schema); ai-health-info is opt-in.
  const grantedCategories: GdprConsentCategory[] = [
    "data-processing",
    ...(consent.aiHealthInfo ? (["ai-health-info"] as const) : []),
  ]

  const profileData = {
    dateOfBirth: new Date(step1.dateOfBirth),
    biologicalSex: step1.biologicalSex,
    healthGoals: JSON.stringify(step2.healthGoals),
    primaryMotivation: step2.primaryMotivation,
    riskTolerance: step2.riskTolerance,
    healthConditions: JSON.stringify(step3.healthConditions),
    supplementStack: JSON.stringify(step3.supplementStack),
    dietaryPattern: step4.dietaryPattern,
    activityLevel: step4.activityLevel,
    sleepQuality: step4.sleepQuality,
    stressLevel: step4.stressLevel,
    onboardingCompletedAt: new Date(),
  }

  // Persist the profile (PHI) and the consent grant atomically — we must never
  // store health data without the consent that authorizes processing it.
  await db.$transaction(async (tx) => {
    await tx.userProfile.upsert({
      where: { userId: session.user.id },
      update: profileData,
      create: { userId: session.user.id, ...profileData },
    })
    await grantGdprConsents(session.user.id, grantedCategories, {
      client: tx,
      policyVersion: consent.policyVersion,
    })
  })

  await logAudit({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? '',
    action: 'onboarding.complete',
    entityType: 'UserProfile',
    entityId: session.user.id,
    details: { goals: step2.healthGoals, consentedCategories: grantedCategories },
  })

  // Award referral reward to referrer (fire-and-forget)
  processReferralReward(session.user.id).catch(() => {})

  return NextResponse.json({ ok: true })
}

/**
 * GET /api/onboarding
 *
 * Check onboarding status for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await db.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { onboardingCompletedAt: true },
  })

  return NextResponse.json({
    completed: !!profile?.onboardingCompletedAt,
    completedAt: profile?.onboardingCompletedAt ?? null,
  })
}
