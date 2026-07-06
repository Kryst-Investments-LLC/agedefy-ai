// Dev-only: seed the demo user with a bio-age snapshot + biomarker trends so the
// cockpit renders real charts. Safe to delete. Run with DATABASE_URL set.
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'demo@biozephyra.dev' } })
  if (!user) throw new Error('demo user missing — run _dev-demo-user.cjs first')
  const uid = user.id
  const day = (n) => new Date(Date.now() - n * 24 * 3600 * 1000)

  await prisma.reminder.deleteMany({ where: { userId: uid } })
  await prisma.protocolOutcome.deleteMany({ where: { userId: uid } })
  await prisma.loopCycle.deleteMany({ where: { userId: uid } })
  await prisma.biologicalAgeSnapshot.deleteMany({ where: { userId: uid } })
  await prisma.biomarker.deleteMany({ where: { userId: uid } })
  await prisma.protocol.deleteMany({ where: { userId: uid } })
  await prisma.subscription.deleteMany({ where: { userId: uid } })

  // Grant a Plus subscription so premium features (AI coach) are unlocked.
  await prisma.subscription.create({
    data: {
      userId: uid,
      tenantId: 'default',
      plan: 'Plus',
      status: 'ACTIVE',
      provider: 'manual',
      priceCents: 5900,
      currency: 'USD',
      billingCycle: 'monthly',
      monthlyAICreditAllowance: 1500,
      currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
    },
  })

  await prisma.biologicalAgeSnapshot.create({
    data: {
      userId: uid,
      tenantId: 'default',
      chronologicalAge: 42,
      biologicalAge: 38.6,
      confidence: 0.82,
      hallmarkScores: {
        genomicInstability: 0.22,
        telomereDysfunction: 0.35,
        epigeneticAlteration: 0.28,
        lossOfProteostasis: 0.41,
        disabledMacroautophagy: 0.3,
        mitochondrialDysfunction: 0.55,
        cellularSenescence: 0.48,
        stemCellExhaustion: 0.26,
        alteredIntercellularCommunication: 0.6,
      },
    },
  })

  const markers = [
    { name: 'Hemoglobin A1c', unit: '%', series: [[120, 5.9], [80, 5.6], [40, 5.4], [5, 5.2]] },
    { name: 'LDL Cholesterol', unit: 'mg/dL', series: [[120, 128], [80, 115], [40, 102], [5, 94]] },
    { name: 'hs-CRP', unit: 'mg/L', series: [[120, 2.4], [80, 1.8], [40, 1.2], [5, 0.8]] },
    { name: 'HDL Cholesterol', unit: 'mg/dL', series: [[120, 44], [80, 48], [40, 52], [5, 58]] },
    { name: 'Fasting Glucose', unit: 'mg/dL', series: [[90, 104], [45, 98], [5, 92]] },
  ]

  for (const m of markers) {
    for (const [ago, val] of m.series) {
      await prisma.biomarker.create({
        data: { userId: uid, tenantId: 'default', name: m.name, unit: m.unit, value: val, measuredAt: day(ago) },
      })
    }
  }
  // Closed-loop payoff: a completed protocol cycle with a measured effect.
  const protocol = await prisma.protocol.create({
    data: { userId: uid, tenantId: 'default', name: 'Metabolic optimization', status: 'active' },
  })
  const cycle = await prisma.loopCycle.create({
    data: { userId: uid, tenantId: 'default', triggeredBy: 'MANUAL', startedAt: day(120), completedAt: day(5) },
  })
  await prisma.protocolOutcome.create({
    data: {
      userId: uid,
      tenantId: 'default',
      loopCycleId: cycle.id,
      protocolId: protocol.id,
      cycleStartDate: day(120),
      cycleEndDate: day(5),
      observedBiomarkers: [
        { name: 'Hemoglobin A1c', observedDelta: -0.7, observedDirection: 'down', confidence: 0.8 },
        { name: 'LDL Cholesterol', observedDelta: -34, observedDirection: 'down', confidence: 0.85 },
        { name: 'hs-CRP', observedDelta: -1.6, observedDirection: 'down', confidence: 0.7 },
        { name: 'HDL Cholesterol', observedDelta: 14, observedDirection: 'up', confidence: 0.75 },
      ],
      overallEfficacy: 0.78,
      twinPredictionAccuracy: 0.71,
    },
  })

  // A delivered reminder so the notification bell shows a real, actionable item.
  await prisma.reminder.create({
    data: {
      userId: uid,
      tenantId: 'default',
      kind: 'REMEASURE',
      title: 'Re-test your biomarker panel',
      detail: 'Re-measure to capture the effect of your current protocol on your markers.',
      dueAt: day(2),
      status: 'PENDING',
      notifiedAt: day(1),
    },
  })

  console.log('seeded bio-age + ' + markers.length + ' biomarker series + protocol outcome + reminder for ' + user.email)
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
