import { getServerSession } from "next-auth"
import Link from "next/link"
import { unstable_cache } from "next/cache"
import { BiomarkerTrends } from "@/components/biomarker-trends"
import { DashboardDailyBrief } from "@/components/dashboard-daily-brief"
import { DashboardWorkspace } from "@/components/dashboard-workspace"
import { EnterpriseOperationsPanel } from "@/components/enterprise-operations-panel"
import { AppShell } from "@/components/app-shell"
import { ProtocolTemplates } from "@/components/protocol-templates"

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

  const [user, biomarkerCount, protocolCount, labOrderCount, pathwayCount, biomarkers, protocols, researchEntries, clinicianTasks, partnerRecords, latestBioAge, wearableConnections] = await Promise.all([
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
    db.bioAgeSnapshot.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }).catch(() => null),
    db.wearableConnection.findMany({
      where: { userId: session.user.id, status: 'active' },
      select: { provider: true, lastSyncAt: true },
      orderBy: { lastSyncAt: 'desc' },
    }),
  ])

  const activeSubscription = user?.subscriptions[0]

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

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <section className="rounded-2xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Biomarkers tracked</p>
            <p className="mt-3 text-3xl font-semibold">{biomarkerCount}</p>
            <p className="mt-2 text-sm text-muted-foreground/70">Real readings stored in the database.</p>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Protocols created</p>
            <p className="mt-3 text-3xl font-semibold">{protocolCount}</p>
            <p className="mt-2 text-sm text-muted-foreground/70">No simulated stacks or inferred outcomes.</p>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Lab orders</p>
            <p className="mt-3 text-3xl font-semibold">{labOrderCount}</p>
            <p className="mt-2 text-sm text-muted-foreground/70">
              <Link href="/lab-testing" className="text-primary hover:underline">View lab testing →</Link>
            </p>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Pathways in graph</p>
            <p className="mt-3 text-3xl font-semibold">{pathwayCount}</p>
            <p className="mt-2 text-sm text-muted-foreground/70">
              <Link href="/pathways" className="text-primary hover:underline">Explore pathways →</Link>
            </p>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Subscription status</p>
            <p className="mt-3 text-3xl font-semibold">
              {activeSubscription ? activeSubscription.status.toLowerCase() : "inactive"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground/70">
              {activeSubscription
                ? `${activeSubscription.plan} plan, renewal ${formatDate(activeSubscription.currentPeriodEnd)}`
                : "No live plan is attached to this account yet."}
            </p>
          </section>
        </div>

        {/* Daily Brief */}
        <DashboardDailyBrief
          bioAgeDelta={
            latestBioAge
              ? {
                  biologicalAge: latestBioAge.biologicalAge,
                  chronologicalAge: latestBioAge.chronologicalAge,
                  delta: latestBioAge.delta,
                }
              : null
          }
          adherence={null}
          urgentTask={
            clinicianTasks.find((t) => t.status === 'OPEN')
              ? { id: clinicianTasks[0].id, title: clinicianTasks[0].title, priority: clinicianTasks[0].priority }
              : null
          }
          wearableSync={
            wearableConnections.length > 0
              ? {
                  connectedDevices: wearableConnections.length,
                  lastSyncAt: wearableConnections[0]?.lastSyncAt?.toISOString() ?? null,
                }
              : null
          }
          className="mt-6"
        />

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
