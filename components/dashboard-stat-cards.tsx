"use client"

import Link from "next/link"
import { useTranslation } from "@/lib/i18n/useTranslation"

interface Props {
  biomarkerCount: number
  protocolCount: number
  labOrderCount: number
  pathwayCount: number
  activeSubscription: {
    status: string
    plan: string
    renewalDate: string | null
  } | null
  userName: string | null
  userEmail: string | null
  accountCreatedAt: string | null
  role: string
}

/**
 * Client wrapper for the dashboard stat cards and header so they re-render
 * when the locale changes. The heavy data (counts, user) is fetched once on
 * the server and passed as props.
 */
export function DashboardStatCards({
  biomarkerCount,
  protocolCount,
  labOrderCount,
  pathwayCount,
  activeSubscription,
  userName,
  userEmail,
  accountCreatedAt,
  role,
}: Props) {
  const { t } = useTranslation()

  function tr(key: string, fallback: string) {
    const v = t(key)
    return v === key ? fallback : v
  }

  const displayName = userName ?? userEmail

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-primary">
            {tr("dashboard.stats.realWorkspace", "Real workspace")}
          </p>
          <h1 className="text-4xl font-bold">{displayName}</h1>
          <p className="mt-2 text-muted-foreground">
            {tr("dashboard.stats.accountCreated", "Persistent account created on")} {accountCreatedAt ?? "—"}.{" "}
            {tr("dashboard.stats.role", "Role")}: {role.toLowerCase()}.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {tr("dashboard.stats.biomarkersTracked", "Biomarkers tracked")}
          </p>
          <p className="mt-3 text-3xl font-semibold">{biomarkerCount}</p>
          <p className="mt-2 text-sm text-muted-foreground/70">
            {tr("dashboard.stats.biomarkersDetail", "Real readings stored in the database.")}
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {tr("dashboard.stats.protocolsCreated", "Protocols created")}
          </p>
          <p className="mt-3 text-3xl font-semibold">{protocolCount}</p>
          <p className="mt-2 text-sm text-muted-foreground/70">
            {tr("dashboard.stats.protocolsDetail", "No simulated stacks or inferred outcomes.")}
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {tr("dashboard.stats.labOrders", "Lab orders")}
          </p>
          <p className="mt-3 text-3xl font-semibold">{labOrderCount}</p>
          <p className="mt-2 text-sm text-muted-foreground/70">
            <Link href="/lab-testing" className="text-primary hover:underline">
              {tr("dashboard.stats.labOrdersLink", "View lab testing")} →
            </Link>
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {tr("dashboard.stats.pathwaysInGraph", "Pathways in graph")}
          </p>
          <p className="mt-3 text-3xl font-semibold">{pathwayCount}</p>
          <p className="mt-2 text-sm text-muted-foreground/70">
            <Link href="/pathways" className="text-primary hover:underline">
              {tr("dashboard.stats.pathwaysLink", "Explore pathways")} →
            </Link>
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {tr("dashboard.stats.subscriptionStatus", "Subscription status")}
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {activeSubscription
              ? activeSubscription.status.toLowerCase()
              : tr("dashboard.stats.subscriptionInactive", "inactive")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground/70">
            {activeSubscription
              ? `${activeSubscription.plan} plan, renewal ${activeSubscription.renewalDate ?? "—"}`
              : tr("dashboard.stats.subscriptionNone", "No live plan is attached to this account yet.")}
          </p>
        </section>
      </div>

      {/* AI Coach + Quick links */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-xl font-semibold">
            {tr("dashboard.stats.aiCoach", "AI Health Coach")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {tr(
              "dashboard.stats.aiCoachDesc",
              "Ask for AI-assisted informational summaries grounded in your tracked biomarkers, protocols, and the knowledge graph.",
            )}
          </p>
          <Link
            href="/personalization"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {tr("dashboard.stats.openAiCoach", "Open AI Coach")} →
          </Link>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-xl font-semibold">
            {tr("dashboard.stats.quickLinks", "Quick links")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Link href="/mixer" className="rounded-lg border p-3 hover:bg-accent transition-colors">
              {tr("navigation.compoundMixer", "Compound Mixer")}
            </Link>
            <Link href="/community" className="rounded-lg border p-3 hover:bg-accent transition-colors">
              {tr("navigation.community", "Community")}
            </Link>
            <Link href="/learn" className="rounded-lg border p-3 hover:bg-accent transition-colors">
              {tr("navigation.learn", "Learning Center")}
            </Link>
            <Link href="/clinical-trials" className="rounded-lg border p-3 hover:bg-accent transition-colors">
              {tr("navigation.clinicalTrials", "Clinical Trials")}
            </Link>
            <Link href="/research" className="rounded-lg border p-3 hover:bg-accent transition-colors">
              {tr("navigation.research", "Research Hub")}
            </Link>
            <Link href="/account" className="rounded-lg border p-3 hover:bg-accent transition-colors">
              {tr("navigation.account", "Account Settings")}
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
