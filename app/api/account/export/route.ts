import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { getAICreditBalanceSnapshot } from "@/lib/ai-credits"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      subscriptions: true,
      billingRecords: { orderBy: { createdAt: "desc" }, take: 1000 },
      biomarkers: { orderBy: { createdAt: "desc" }, take: 10000 },
      protocols: { orderBy: { createdAt: "desc" }, take: 5000 },
      researchCollections: {
        take: 500,
        include: { entries: { take: 100 } },
      },
      clinicianTasks: { orderBy: { createdAt: "desc" }, take: 5000 },
      partnerDataRecords: { orderBy: { createdAt: "desc" }, take: 5000 },
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const aiCreditBalance = await getAICreditBalanceSnapshot(session.user.id)

  await logAudit({
    actorUserId: session.user.id,
    actorEmail: user.email,
    action: "account.data_export",
    entityType: "user",
    entityId: session.user.id,
  })

  const exportData = {
    exportedAt: new Date().toISOString(),
    purchasedAICreditBalance: aiCreditBalance.purchasedCreditsRemaining,
    aiCreditBalance,
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
    profile: user.profile
      ? {
          dateOfBirth: user.profile.dateOfBirth?.toISOString() ?? null,
          biologicalSex: user.profile.biologicalSex,
          longevityGoal: user.profile.longevityGoal,
          riskTolerance: user.profile.riskTolerance,
        }
      : null,
    subscriptions: user.subscriptions.map((s) => ({
      plan: s.plan,
      status: s.status,
      provider: s.provider,
      priceCents: s.priceCents,
      currency: s.currency,
      billingCycle: s.billingCycle,
      regionTier: s.regionTier,
      seatQuantity: s.seatQuantity,
      monthlyAICreditAllowance: s.monthlyAICreditAllowance,
      createdAt: s.createdAt.toISOString(),
    })),
    billingRecords: user.billingRecords.map((record) => ({
      category: record.category,
      status: record.status,
      description: record.description,
      amountCents: record.amountCents,
      currency: record.currency,
      regionTier: record.regionTier,
      aiCreditPackKey: record.aiCreditPackKey,
      aiCreditSource: record.aiCreditSource,
      aiCreditsDelta: record.aiCreditsDelta,
      pricingModel: record.pricingModel,
      paidAt: record.paidAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      metadata: record.metadata,
    })),
    biomarkers: user.biomarkers.map((b) => ({
      name: b.name,
      value: b.value,
      unit: b.unit,
      target: b.target,
      trend: b.trend,
      measuredAt: b.measuredAt.toISOString(),
    })),
    protocols: user.protocols.map((p) => ({
      name: p.name,
      status: p.status,
      description: p.description,
      createdAt: p.createdAt.toISOString(),
    })),
    researchCollections: user.researchCollections.map((c) => ({
      name: c.name,
      description: c.description,
      entries: c.entries.map((e) => ({
        title: e.title,
        source: e.source,
        externalId: e.externalId,
        authors: e.authors,
        abstract: e.abstract,
        url: e.url,
        publishedAt: e.publishedAt?.toISOString() ?? null,
      })),
    })),
    clinicianTasks: user.clinicianTasks.map((t) => ({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    partnerData: user.partnerDataRecords.map((r) => ({
      source: r.source,
      partnerId: r.partnerId,
      label: r.label,
      payload: r.payload,
      receivedAt: r.receivedAt.toISOString(),
    })),
  }

  return NextResponse.json(exportData)
}
