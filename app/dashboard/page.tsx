import { getServerSession } from "next-auth"
import { unstable_cache } from "next/cache"
import { BiomarkerTrends } from "@/components/biomarker-trends"
import { DashboardDailyBrief } from "@/components/dashboard-daily-brief"
import { DashboardWorkspace } from "@/components/dashboard-workspace"
import { DashboardStatCards } from "@/components/dashboard-stat-cards"
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
        <DashboardStatCards
          biomarkerCount={biomarkerCount}
          protocolCount={protocolCount}
          labOrderCount={labOrderCount}
          pathwayCount={pathwayCount}
          activeSubscription={
            activeSubscription
              ? {
                  status: activeSubscription.status,
                  plan: activeSubscription.plan,
                  renewalDate: activeSubscription.currentPeriodEnd
                    ? formatDate(activeSubscription.currentPeriodEnd)
                    : null,
                }
              : null
          }
          userName={user?.name ?? null}
          userEmail={user?.email ?? null}
          accountCreatedAt={formatDate(user?.createdAt)}
          role={session.user.role}
        />

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
