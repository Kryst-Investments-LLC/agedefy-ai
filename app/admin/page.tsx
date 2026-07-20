// CI-008: reads required data from the database — force dynamic rendering so
// the DB is queried at request time, never at build (a DB failure can then
// never be swallowed into a statically-generated page).
export const dynamic = "force-dynamic"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { AdminCommunityModeration } from "@/components/admin-community-moderation"
import { AdminMarketplacePayoutQueue } from "@/components/admin-marketplace-payout-queue"
import { AdminOrchestrationOverview } from "@/components/admin-orchestration-overview"
import { AdminReviewConsole } from "@/components/admin-review-console"
import { AdminUserManagement } from "@/components/admin-user-management"
import { AppShell } from "@/components/app-shell"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const marketplaceAuditWindowStart = new Date()
  marketplaceAuditWindowStart.setDate(marketplaceAuditWindowStart.getDate() - 7)

  const [
    reviewItems,
    auditLogs,
    flaggedCount,
    totalUsers,
    activeSubscriptions,
    totalBiomarkers,
    totalProtocols,
    totalLabOrders,
    totalConsultations,
    totalMarketplaceOrders,
    totalMarketplaceDiscoveries,
    totalMarketplaceFundingRequests,
    totalMarketplaceDealRooms,
    totalMarketplaceTransactions,
    totalMarketplaceNotifications,
    recentMarketplaceAuditEvents,
    settledMarketplaceTransactions,
    totalPosts,
    users,
  ] = await Promise.all([
    db.reviewItem.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.communityPost.count({ where: { flagged: true } }),
    db.user.count(),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.biomarker.count(),
    db.protocol.count(),
    db.labOrder.count(),
    db.consultationRequest.count(),
    db.marketplaceOrder.count(),
    db.marketplaceDiscovery.count(),
    db.marketplaceFundingRequest.count(),
    db.marketplaceDealRoom.count(),
    db.marketplaceTransaction.count(),
    db.marketplaceNotification.count(),
    db.marketplaceAuditLog.count({ where: { createdAt: { gte: marketplaceAuditWindowStart } } }),
    db.marketplaceTransaction.findMany({
      where: { status: "SETTLED" },
      orderBy: { updatedAt: "desc" },
      take: 25,
      include: {
        discovery: {
          select: {
            id: true,
            title: true,
          },
        },
        dealRoom: {
          select: {
            id: true,
            scientist: {
              select: {
                displayName: true,
              },
            },
            sponsor: {
              select: {
                organizationName: true,
              },
            },
          },
        },
      },
    }),
    db.communityPost.count(),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            biomarkers: true,
            protocols: true,
            labOrders: true,
            subscriptions: true,
          },
        },
      },
    }),
  ])

  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="mx-auto max-w-7xl px-4 py-10 text-foreground">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">Enterprise control</p>
          <h1 className="mt-3 text-4xl font-bold">Admin Console</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Platform statistics, user management, audit events, review queue, and community moderation.
            {flaggedCount > 0 && (
              <span className="ml-2 text-red-600 dark:text-red-400 font-medium">{flaggedCount} flagged post{flaggedCount > 1 ? "s" : ""} need review.</span>
            )}
          </p>
        </div>

        {/* Platform Statistics */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Platform Statistics</h2>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              { label: "Total users", value: totalUsers },
              { label: "Active subscriptions", value: activeSubscriptions },
              { label: "Biomarker records", value: totalBiomarkers },
              { label: "Protocols", value: totalProtocols },
              { label: "Lab orders", value: totalLabOrders },
              { label: "Consultations", value: totalConsultations },
              { label: "Marketplace orders", value: totalMarketplaceOrders },
              { label: "Marketplace discoveries", value: totalMarketplaceDiscoveries },
              { label: "Marketplace deal rooms", value: totalMarketplaceDealRooms },
              { label: "Community posts", value: totalPosts },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-background p-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <AdminOrchestrationOverview />

        <section className="mb-10 rounded-3xl border border-border bg-background p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Scientist-Sponsor Marketplace Operations</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Monitor deal flow, funding activity, notifications, and audit volume for the marketplace module from the same admin surface used for core platform controls.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/scientist-sponsor-marketplace">
                <Button variant="outline" className="border-border text-gray-100 hover:bg-gray-800">Open canonical workspace</Button>
              </Link>
              <Link href="/scientist-sponsor">
                <Button variant="ghost" className="text-gray-200 hover:bg-gray-800">Open alias route</Button>
              </Link>
              <Link href="/api/admin/marketplace-audit-export" target="_blank">
                <Button variant="ghost" className="text-gray-200 hover:bg-gray-800">Export marketplace audits</Button>
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Funding requests", value: totalMarketplaceFundingRequests },
              { label: "Marketplace transactions", value: totalMarketplaceTransactions },
              { label: "Marketplace notifications", value: totalMarketplaceNotifications },
              { label: "Marketplace deal rooms", value: totalMarketplaceDealRooms },
              { label: "Discoveries", value: totalMarketplaceDiscoveries },
              { label: "Audit events (7d)", value: recentMarketplaceAuditEvents },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-background p-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <AdminMarketplacePayoutQueue
          items={settledMarketplaceTransactions.map((transaction) => ({
            id: transaction.id,
            dealRoomId: transaction.dealRoomId,
            discoveryId: transaction.discoveryId,
            discoveryTitle: transaction.discovery.title,
            amountCents: transaction.amountCents,
            payoutCents: transaction.payoutCents,
            currency: transaction.currency,
            status: transaction.status,
            createdAt: transaction.createdAt.toISOString(),
            updatedAt: transaction.updatedAt.toISOString(),
            scientistName: transaction.dealRoom.scientist.displayName,
            sponsorName: transaction.dealRoom.sponsor.organizationName,
            metadata: transaction.metadata ?? null,
          }))}
        />

        {/* User Management */}
        <section className="mb-10">
          <AdminUserManagement
            users={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              emailVerified: !!u.emailVerified,
              createdAt: u.createdAt.toISOString(),
              biomarkerCount: u._count.biomarkers,
              protocolCount: u._count.protocols,
              labOrderCount: u._count.labOrders,
              subscriptionCount: u._count.subscriptions,
            }))}
          />
        </section>

        <div className="mb-8">
          <AdminCommunityModeration />
        </div>

        <AdminReviewConsole
          reviewItems={reviewItems.map((item) => ({
            id: item.id,
            title: item.title,
            category: item.category,
            status: item.status,
            severity: item.severity,
            details: item.details,
            createdAt: item.createdAt.toISOString(),
          }))}
          auditLogs={auditLogs.map((log) => ({
            id: log.id,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            actorEmail: log.actorEmail,
            createdAt: log.createdAt.toISOString(),
            details: log.details != null ? JSON.stringify(log.details) : null,
          }))}
        />
      </main>
    </div>
    </AppShell>
  )
}
