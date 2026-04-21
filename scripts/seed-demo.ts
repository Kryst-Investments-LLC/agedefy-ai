/**
 * seed-demo.ts
 * Creates a demo account, realistic biomarker readings, and research entries
 * for the grant video recording.
 *
 * Run:
 *   npx tsx scripts/seed-demo.ts
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

const DEMO_EMAIL = "demo@biozephyra.com"
const DEMO_PASSWORD = "Demo2026!"
const DEMO_NAME = "Dr. Alex Longevity"

async function main() {
  console.log("🌱  Seeding demo data…\n")

  // ─── 1. Demo user ────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)

  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash, name: DEMO_NAME },
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      name: DEMO_NAME,
      role: "MEMBER",
      emailVerified: new Date(),
      discoveryTier: "pro",
    },
  })

  console.log(`✅  Demo user: ${user.email}  (id: ${user.id})`)

  // ─── 2. Biomarker readings ────────────────────────────────────────────────
  const biomarkers = [
    {
      name: "Fasting Glucose",
      value: 88,
      unit: "mg/dL",
      target: 85,
      trend: "STABLE" as const,
      source: "lab:quest-diagnostics",
      measuredAt: daysAgo(0),
    },
    {
      name: "Total Testosterone",
      value: 680,
      unit: "ng/dL",
      target: 700,
      trend: "UP" as const,
      source: "lab:labcorp",
      measuredAt: daysAgo(3),
    },
    {
      name: "hs-CRP (Inflammation)",
      value: 0.6,
      unit: "mg/L",
      target: 1.0,
      trend: "DOWN" as const,
      source: "lab:quest-diagnostics",
      measuredAt: daysAgo(7),
    },
    {
      name: "IGF-1",
      value: 182,
      unit: "ng/mL",
      target: 190,
      trend: "STABLE" as const,
      source: null,
      measuredAt: daysAgo(14),
    },
    {
      name: "HbA1c",
      value: 5.2,
      unit: "%",
      target: 5.0,
      trend: "DOWN" as const,
      source: "lab:quest-diagnostics",
      measuredAt: daysAgo(30),
    },
    {
      name: "DHEA-S",
      value: 245,
      unit: "mcg/dL",
      target: 280,
      trend: "UP" as const,
      source: "lab:labcorp",
      measuredAt: daysAgo(30),
    },
  ]

  let bCount = 0
  for (const b of biomarkers) {
    await db.biomarker.create({
      data: { ...b, userId: user.id, tenantId: "default" },
    })
    bCount++
  }
  console.log(`✅  Created ${bCount} biomarker readings`)

  // ─── 3. Research collection + entries ────────────────────────────────────
  const collection = await db.researchCollection.upsert({
    where: { id: "demo-collection-001" },
    update: {},
    create: {
      id: "demo-collection-001",
      name: "Longevity Interventions",
      description: "Key peer-reviewed studies on NMN, Rapamycin, and Fisetin.",
      userId: user.id,
      tenantId: "default",
    },
  })

  const entries = [
    {
      title:
        "Nicotinamide Mononucleotide (NMN) supplementation rescues age-associated decline in skeletal muscle oxidative capacity",
      authors: "Mills KF, Yoshida S, Stein LR, et al.",
      abstract:
        "Oral administration of NMN mitigates age-associated physiological decline in energy metabolism, physical activity, and insulin sensitivity in mice. NMN is efficiently synthesized and absorbed in mice within 15 minutes and converted to NAD+ in multiple tissues.",
      url: "https://pubmed.ncbi.nlm.nih.gov/27127236/",
      source: "PUBMED" as const,
      externalId: "PMID:27127236",
      publishedAt: new Date("2016-11-15"),
    },
    {
      title:
        "Rapamycin, an inhibitor of the nutrient-sensing mTOR pathway, extends mammalian lifespan",
      authors: "Harrison DE, Strong R, Sharp ZD, et al.",
      abstract:
        "Rapamycin fed to mice late in life (600 days) extended median and maximum lifespan in both sexes. This is the first demonstration of a drug that acts on a well-described signaling pathway that extends mammalian lifespan when administered late in life.",
      url: "https://pubmed.ncbi.nlm.nih.gov/19587680/",
      source: "PUBMED" as const,
      externalId: "PMID:19587680",
      publishedAt: new Date("2009-07-16"),
    },
    {
      title:
        "Fisetin is a senotherapeutic that extends health and lifespan",
      authors: "Yousefzadeh MJ, Zhu Y, McGowan SJ, et al.",
      abstract:
        "Of the 10 flavonoids tested, fisetin had the greatest senolytic activity. Fisetin reduced senescence in multiple tissues, improved health, and extended lifespan in old mice.",
      url: "https://pubmed.ncbi.nlm.nih.gov/30279143/",
      source: "PUBMED" as const,
      externalId: "PMID:30279143",
      publishedAt: new Date("2018-10-01"),
    },
  ]

  let rCount = 0
  for (const entry of entries) {
    const exists = await db.researchEntry.findFirst({
      where: { externalId: entry.externalId, collectionId: collection.id },
    })
    if (!exists) {
      await db.researchEntry.create({
        data: { ...entry, collectionId: collection.id },
      })
      rCount++
    }
  }
  console.log(`✅  Created ${rCount} research entries (${entries.length - rCount} already existed)`)

  // ─── 4. Audit log entry ───────────────────────────────────────────────────
  await db.auditLog.create({
    data: {
      actorUserId: user.id,
      actorEmail: user.email,
      action: "demo.seed",
      entityType: "system",
      details: JSON.stringify({ seedVersion: "1.0", purpose: "grant-video" }),
    },
  })
  console.log(`✅  Audit log entry created`)

  // ─── 5. Active Plus subscription (unlocks premium features) ──────────────
  // The platform's `hasPremiumEntitlement()` check looks for an ACTIVE/TRIALING
  // Subscription whose plan name is in the premium set ("Plus", "Clinic & Research",
  // "Enterprise"). We need this so the demo can walk through AI Personalization,
  // Lab Testing, Clinical Trials Explorer, etc., during the grant video.
  const existingSub = await db.subscription.findFirst({
    where: { userId: user.id, status: { in: ["ACTIVE", "TRIALING"] } },
  })
  if (!existingSub) {
    await db.subscription.create({
      data: {
        userId: user.id,
        tenantId: "default",
        plan: "Plus",
        status: "ACTIVE",
        provider: "manual",
        priceCents: 4900,
        currency: "USD",
        billingCycle: "monthly",
        seatQuantity: 1,
        monthlyAICreditAllowance: 500,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    console.log(`✅  Active "Plus" subscription created (premium features unlocked)`)
  } else {
    console.log(`ℹ️  Active subscription already present (plan: ${existingSub.plan})`)
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DEMO CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email:    ${DEMO_EMAIL}
  Password: ${DEMO_PASSWORD}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Compound Mixer pre-load URL:
  http://localhost:3000/mixer?compounds=Rapamycin,NMN,Fisetin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
