// CI-008: reads required data from the database — force dynamic rendering so
// the DB is queried at request time, never at build (a DB failure can then
// never be swallowed into a statically-generated page).
export const dynamic = "force-dynamic"
import { getServerSession } from "next-auth"
import Link from "next/link"
import { unstable_cache } from "next/cache"
import { BiomarkerTrends } from "@/components/biomarker-trends"
import { DashboardWorkspace } from "@/components/dashboard-workspace"
import { BiomarkerBulkAdd } from "@/components/biomarker-bulk-add"
import { EnterpriseOperationsPanel } from "@/components/enterprise-operations-panel"
import { AppShell } from "@/components/app-shell"
import { ProtocolTemplates } from "@/components/protocol-templates"
import { DashboardCockpit, type CockpitMarkerSeries, type DoNextAction } from "@/components/dashboard-cockpit"
import { SafetyEvidenceTrail, type LatestAnalysis } from "@/components/safety-evidence-trail"
import { MeasurementLoop, type LoopStage } from "@/components/measurement-loop"
import { EffectReadout } from "@/components/effect-readout"
import { getLatestProtocolEffect } from "@/lib/outcomes/latest-effect"
import { ReMeasureReminder } from "@/components/remeasure-reminder"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// Cache global pathway count — rarely changes, shared across all users
const getCachedPathwayCount = unstable_cache(
  () => db.pathway.count(),
  ["global-pathway-count"],
  { revalidate: 300 }, // 5 minutes
)

function formatDate(date: Date | null | undefined) {
  if (!date) {
    return "Not available"
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return null
  }

  const [user, biomarkerCount, protocolCount, labOrderCount, pathwayCount, biomarkers, protocols, researchEntries, clinicianTasks, partnerRecords, latestBioAge] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    db.biomarker.count({ where: { userId: session.user.id } }),
    db.protocol.count({ where: { userId: session.user.id } }),
    db.labOrder.count({ where: { userId: session.user.id } }),
    getCachedPathwayCount(),
    db.biomarker.findMany({
      where: { userId: session.user.id },
      orderBy: { measuredAt: "desc" },
      take: 8,
    }),
    db.protocol.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    db.researchEntry.findMany({
      where: { collection: { userId: session.user.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.clinicianTask.findMany({
      where: { userId: session.user.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 10,
    }),
    db.partnerDataRecord.findMany({
      where: { userId: session.user.id },
      orderBy: { receivedAt: "desc" },
      take: 10,
    }),
    db.biologicalAgeSnapshot.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const activeSubscription = user?.subscriptions[0]

  // ── Build cockpit inputs ─────────────────────────────────────────────
  const biomarkerHistory = await db.biomarker.findMany({
    where: { userId: session.user.id },
    orderBy: { measuredAt: "asc" },
    take: 300,
    select: { name: true, unit: true, value: true, measuredAt: true },
  })

  const seriesByName = new Map<string, CockpitMarkerSeries>()
  for (const b of biomarkerHistory) {
    const s = seriesByName.get(b.name) ?? { name: b.name, unit: b.unit, points: [] }
    s.points.push({ date: b.measuredAt.toISOString(), value: b.value })
    seriesByName.set(b.name, s)
  }
  const markerSeries = [...seriesByName.values()]

  const cockpitBioAge = latestBioAge
    ? {
        biologicalAge: latestBioAge.biologicalAge,
        chronologicalAge: latestBioAge.chronologicalAge,
        delta: latestBioAge.biologicalAge - latestBioAge.chronologicalAge,
        confidence: latestBioAge.confidence,
        hallmarkScores: (latestBioAge.hallmarkScores ?? {}) as Record<string, number>,
      }
    : null

  // ── Safety & evidence trail (latest agent analysis) ─────────────────
  const latestSession = await db.agentSession.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, goal: true, status: true, result: true, createdAt: true },
  })
  let latestAnalysis: LatestAnalysis | null = null
  if (latestSession) {
    const claims = await db.agentClaim.findMany({
      where: { sessionId: latestSession.id },
      select: { claimText: true, evidenceKind: true, confidence: true },
      orderBy: { confidence: "desc" },
      take: 6,
    })
    let safetyFlagCount = 0
    try {
      const parsed = latestSession.result ? (JSON.parse(latestSession.result) as { safetyFlags?: unknown[] }) : null
      if (Array.isArray(parsed?.safetyFlags)) safetyFlagCount = parsed.safetyFlags.length
    } catch {
      /* result not JSON — leave count at 0 */
    }
    latestAnalysis = {
      goal: latestSession.goal,
      status: latestSession.status,
      createdAt: latestSession.createdAt.toISOString(),
      safetyFlagCount,
      requiresReview: latestSession.status === "AWAITING_REVIEW",
      citations: claims.map((c) => ({
        claimText: c.claimText,
        evidenceKind: String(c.evidenceKind),
        confidence: c.confidence,
      })),
    }
  }

  // ── Closed measurement loop stages (derived from real data) ─────────
  const latestEffect = await getLatestProtocolEffect(session.user.id)
  const pendingReminder = await db.reminder.findFirst({
    where: { userId: session.user.id, kind: "REMEASURE", status: "PENDING" },
    orderBy: { dueAt: "asc" },
    select: { id: true, dueAt: true, title: true },
  })
  const reminderInitial = pendingReminder
    ? { id: pendingReminder.id, dueAt: pendingReminder.dueAt.toISOString(), title: pendingReminder.title }
    : null
  const hasReMeasured = markerSeries.some((m) => m.points.length >= 2)
  const loopStages: LoopStage[] = [
    { key: "measure", label: "Measure", hint: "Baseline biomarkers", done: biomarkerCount > 0, href: "/lab-testing", cta: "Add or order a baseline panel" },
    { key: "recommend", label: "Recommend", hint: "AI protocol", done: protocolCount > 0, href: "/personalization", cta: "Generate a protocol recommendation" },
    { key: "act", label: "Act", hint: "Order & adhere", done: labOrderCount > 0 || protocolCount > 0, href: "/marketplace", cta: "Order your stack or labs" },
    { key: "remeasure", label: "Re-measure", hint: "Track the change", done: hasReMeasured, href: "/lab-testing", cta: "Re-test to capture the change" },
    // "See effect" is real now: it lights only when a ProtocolOutcome has been written.
    { key: "effect", label: "See effect", hint: "Causal readout", done: latestEffect !== null, href: "/insights", cta: "Complete a protocol cycle to measure the effect" },
  ]

  const urgentTask = clinicianTasks.find((t) => t.status === "PENDING")
  const doNext: DoNextAction[] = [
    ...(urgentTask
      ? [{ label: `Review: ${urgentTask.title}`, href: "/account", urgent: true }]
      : []),
    ...(!latestBioAge ? [{ label: "Compute your biological age", href: "/bio-age" }] : []),
    ...(biomarkerCount === 0 ? [{ label: "Add your first biomarker panel", href: "/dashboard#add" }] : []),
    ...(!activeSubscription ? [{ label: "Choose a plan to unlock AI coaching", href: "/pricing" }] : []),
    { label: "Ask the AI Health Coach", href: "/personalization" },
  ].slice(0, 4)

  return (
    <AppShell pageTitle="Dashboard">
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-primary">Real workspace</p>
            <h1 className="text-4xl font-bold">{user?.name ?? user?.email}</h1>
            <p className="mt-2 text-muted-foreground">
              Persistent account created on {formatDate(user?.createdAt)}. Role: {session.user.role.toLowerCase()}.
            </p>
          </div>
        </div>

        {/* Health cockpit — hero score + what changed / do next */}
        <DashboardCockpit bioAge={cockpitBioAge} markerSeries={markerSeries} doNext={doNext} />

        {/* Closed measurement loop */}
        <div className="mt-6 space-y-3">
          <MeasurementLoop stages={loopStages} />
          <ReMeasureReminder initial={reminderInitial} />
        </div>

        {/* Measured effect — the real causal readout that closes the loop */}
        {latestEffect && (
          <div className="mt-6">
            <EffectReadout effect={latestEffect} />
          </div>
        )}

        {/* Safety & evidence trail — the trust moat, made visible */}
        <div className="mt-6">
          <SafetyEvidenceTrail latest={latestAnalysis} />
        </div>

        {/* At a glance — secondary counts */}
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">At a glance</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <section className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Biomarkers</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{biomarkerCount}</p>
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Protocols</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{protocolCount}</p>
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Lab orders</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{labOrderCount}</p>
              <Link href="/lab-testing" className="mt-1 inline-block text-xs text-primary hover:underline">View →</Link>
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Pathways</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{pathwayCount}</p>
              <Link href="/pathways" className="mt-1 inline-block text-xs text-primary hover:underline">Explore →</Link>
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="mt-2 text-2xl font-semibold capitalize">
                {activeSubscription ? activeSubscription.status.toLowerCase() : "inactive"}
              </p>
              {!activeSubscription && (
                <Link href="/pricing" className="mt-1 inline-block text-xs text-primary hover:underline">Choose →</Link>
              )}
            </section>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold">AI Health Coach</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask for AI-assisted informational summaries grounded in your tracked biomarkers, protocols, and the knowledge graph.
            </p>
            <Link
              href="/personalization"
              className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Open AI Coach →
            </Link>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Quick links</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Link href="/mixer" className="rounded-lg border p-3 hover:bg-accent transition-colors">Compound Mixer</Link>
              <Link href="/community" className="rounded-lg border p-3 hover:bg-accent transition-colors">Community</Link>
              <Link href="/learn" className="rounded-lg border p-3 hover:bg-accent transition-colors">Learning Center</Link>
              <Link href="/clinical-trials" className="rounded-lg border p-3 hover:bg-accent transition-colors">Clinical Trials</Link>
              <Link href="/research" className="rounded-lg border p-3 hover:bg-accent transition-colors">Research Hub</Link>
              <Link href="/account" className="rounded-lg border p-3 hover:bg-accent transition-colors">Account Settings</Link>
            </div>
          </section>
        </div>

        <div className="mb-6">
          <BiomarkerBulkAdd />
        </div>

        <DashboardWorkspace
          biomarkers={biomarkers.map((biomarker) => ({
            id: biomarker.id,
            name: biomarker.name,
            value: biomarker.value,
            unit: biomarker.unit,
            target: biomarker.target,
            trend: biomarker.trend,
            measuredAt: biomarker.measuredAt.toISOString(),
          }))}
          protocols={protocols.map((protocol) => ({
            id: protocol.id,
            name: protocol.name,
            description: protocol.description,
            status: protocol.status,
            updatedAt: protocol.updatedAt.toISOString(),
          }))}
        />

        <div className="mt-8">
          <BiomarkerTrends />
        </div>

        <div className="mt-8">
          <ProtocolTemplates />
        </div>

        <EnterpriseOperationsPanel
          researchEntries={researchEntries.map((entry) => ({
            id: entry.id,
            source: entry.source,
            externalId: entry.externalId,
            title: entry.title,
            authors: entry.authors,
            url: entry.url,
            publishedAt: entry.publishedAt?.toISOString() ?? null,
          }))}
          clinicianTasks={clinicianTasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueAt: task.dueAt?.toISOString() ?? null,
            createdAt: task.createdAt.toISOString(),
          }))}
          partnerRecords={partnerRecords.map((record) => ({
            id: record.id,
            source: record.source,
            partnerId: record.partnerId,
            label: record.label,
            receivedAt: record.receivedAt.toISOString(),
          }))}
        />
      </main>
    </AppShell>
  )
}
