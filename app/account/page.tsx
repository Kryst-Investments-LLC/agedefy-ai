import { getServerSession } from "next-auth"
import Link from "next/link"
import { AccountBillingActions } from "@/components/account-billing-actions"
import { AccountDataActions } from "@/components/account-data-actions"
import { AccountManagement } from "@/components/account-management"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"

import { formatAICreditSource, getAICreditBalanceSnapshot } from "@/lib/ai-credits"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { getActiveSubscription } from "@/lib/entitlements"
import { getAssumableMarketplaceRoles } from "@/scientist-sponsor-marketplace/shared/utils"

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}

function formatCreditDelta(value: number) {
  if (value === 0) {
    return null
  }

  return `${value > 0 ? "+" : ""}${value.toLocaleString()} credits`
}

export default async function AccountPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return null
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      profile: true,
      subscriptions: {
        orderBy: { createdAt: "desc" },
      },
      billingRecords: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  })
  const activeSubscription = await getActiveSubscription(session.user.id)
  const aiCreditBalance = await getAICreditBalanceSnapshot(session.user.id)
  const marketplaceRoles = getAssumableMarketplaceRoles(session.user.role)

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 py-10 text-white">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">Account</p>
          <h1 className="text-4xl font-bold">{user?.name ?? "Account"}</h1>
          <p className="mt-2 text-gray-400">Email: {user?.email}</p>
          <p className="mt-2 text-sm text-gray-500">Entitlement: {activeSubscription ? `${activeSubscription.plan} (${activeSubscription.status.toLowerCase()})` : "No active subscription"}</p>
          {session.user.role === "ADMIN" ? (
            <div className="mt-4">
              <Link href="/admin">
                <Button variant="outline" className="border-gray-700 text-gray-100 hover:bg-gray-800">Open admin console</Button>
              </Link>
            </div>
          ) : null}
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="text-lg font-semibold">Identity</h2>
            <dl className="mt-4 space-y-3 text-sm text-gray-300">
              <div className="flex justify-between gap-4">
                <dt>Role</dt>
                <dd>{session.user.role.toLowerCase()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Longevity goal</dt>
                <dd>{user?.profile?.longevityGoal ?? "Not set"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Risk tolerance</dt>
                <dd>{user?.profile?.riskTolerance ?? "Not set"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="text-lg font-semibold">Subscriptions</h2>
            {user?.subscriptions.length ? (
              <div className="mt-4 space-y-4">
                {user.subscriptions.map((subscription) => (
                  <div key={subscription.id} className="rounded-xl border border-gray-800 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{subscription.plan}</p>
                        <p className="text-sm text-gray-400">
                          {subscription.status.toLowerCase()}
                          {subscription.regionTier ? ` · ${subscription.regionTier}` : ""}
                          {subscription.seatQuantity > 1 ? ` · ${subscription.seatQuantity} seats` : ""}
                        </p>
                        {subscription.monthlyAICreditAllowance !== null ? (
                          <p className="mt-1 text-xs text-gray-500">{subscription.monthlyAICreditAllowance.toLocaleString()} AI credits per month</p>
                        ) : null}
                      </div>
                      <p>{formatCurrency(subscription.priceCents, subscription.currency)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-400">No active subscriptions are stored for this account yet.</p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <h2 className="text-lg font-semibold">AI credit balances</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-sm text-gray-400">Included this month</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {(aiCreditBalance.includedCreditsRemaining ?? 0).toLocaleString()} / {(aiCreditBalance.includedCreditsTotal ?? 0).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-gray-500">{aiCreditBalance.includedCreditsConsumed.toLocaleString()} consumed since reset</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-sm text-gray-400">Purchased top-ups remaining</p>
                <p className="mt-2 text-2xl font-semibold text-white">{aiCreditBalance.purchasedCreditsRemaining.toLocaleString()}</p>
                <p className="mt-1 text-xs text-gray-500">{aiCreditBalance.pendingReservedCredits.toLocaleString()} credits currently reserved</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-400">
              {`Monthly included credits reset on ${formatDateTime(new Date(aiCreditBalance.nextResetAt))}. Purchased credits remain available until consumed.`}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6 md:col-span-2">
            <h2 className="text-lg font-semibold">Billing records</h2>
            {user?.billingRecords.length ? (
              <div className="mt-4 space-y-3">
                {user.billingRecords.map((record) => (
                  <div key={record.id} className="rounded-xl border border-gray-800 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-white">{record.description}</p>
                        <p className="mt-1 text-sm text-gray-400">
                          {record.category.toLowerCase().replaceAll("_", " ")} · {record.status.toLowerCase()}
                          {formatCreditDelta(record.aiCreditsDelta) ? ` · ${formatCreditDelta(record.aiCreditsDelta)}` : ""}
                          {formatAICreditSource(record.aiCreditSource) ? ` · ${formatAICreditSource(record.aiCreditSource)}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{formatDateTime(record.createdAt)}</p>
                      </div>
                      <p className="text-sm text-gray-200">{formatCurrency(record.amountCents, record.currency)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-400">No billable service records or AI top-ups have been stored for this account yet.</p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6 md:col-span-2">
            <h2 className="text-lg font-semibold">Scientist-Sponsor Marketplace</h2>
            <p className="mt-2 text-sm text-gray-400">
              Marketplace access is derived from your platform role and uses the same authenticated workspace session.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-300">
              {marketplaceRoles.map((role) => (
                <span key={role} className="rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-teal-200">
                  {role}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/scientist-sponsor">
                <Button variant="outline" className="border-gray-700 text-gray-100 hover:bg-gray-800">Open scientist-sponsor workspace</Button>
              </Link>
              <Link href="/scientist-sponsor-marketplace">
                <Button variant="ghost" className="text-gray-200 hover:bg-gray-800">Open canonical route</Button>
              </Link>
            </div>
          </div>
        </section>

        <AccountBillingActions hasStripeCustomer={!!user?.stripeCustomerId} />

        <AccountDataActions />

        <AccountManagement
          profile={user?.profile ? { longevityGoal: user.profile.longevityGoal, riskTolerance: user.profile.riskTolerance } : null}
          subscriptions={user?.subscriptions.map((subscription) => ({
            id: subscription.id,
            plan: subscription.plan,
            status: subscription.status,
            priceCents: subscription.priceCents,
            currency: subscription.currency,
            billingCycle: subscription.billingCycle,
          })) ?? []}
        />
      </main>
    </div>
  )
}
