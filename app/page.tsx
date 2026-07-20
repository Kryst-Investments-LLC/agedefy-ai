import Link from "next/link"

import { Features } from "@/components/features"
import { Stats } from "@/components/stats"
import { Footer } from "@/components/footer"
import { CookieConsent } from "@/components/cookie-consent"
import { AppShell } from "@/components/app-shell"
import { CompoundRain } from "@/components/landing/compound-rain"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const [userCount, biomarkerCount, compoundCount] = await Promise.all([
    db.user.count(),
    db.biomarker.count(),
    db.compound.count(),
  ])

  // Each landing stat is hidden until it crosses a credibility threshold, so
  // early/low counts aren't shown publicly. The row disappears entirely when
  // nothing qualifies. Tune these thresholds as the platform grows.
  const LANDING_STAT_THRESHOLDS = { users: 100, biomarkers: 1000, compounds: 50 }
  const landingStats = [
    { value: userCount, label: "registered users", min: LANDING_STAT_THRESHOLDS.users },
    { value: biomarkerCount, label: "biomarker readings", min: LANDING_STAT_THRESHOLDS.biomarkers },
    { value: compoundCount, label: "compounds in graph", min: LANDING_STAT_THRESHOLDS.compounds },
  ].filter((stat) => stat.value >= stat.min)

  return (
    <AppShell pageTitle="Home">
      <div className="min-h-full bg-background text-foreground">

      {/* Hero */}
      <div className="relative overflow-hidden">
      <CompoundRain />
      <section className="relative mx-auto max-w-6xl px-4 py-20">
        <p className="text-sm uppercase tracking-[0.2em] text-primary">The longevity intelligence platform</p>
        <h1 className="mt-4 max-w-4xl text-5xl font-bold leading-tight">
          Track biomarkers. Manage protocols. Explore longevity research — all in one platform.
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
          Biozephyra combines biomarker tracking, a curated compound knowledge graph, AI-assisted informational coaching, physician consultation workflows, lab testing, and a marketplace with tracked inventory and audit trails.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/sign-up">
            <Button size="lg" className="text-lg px-6 py-3">Get started free</Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="lg">View plans</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg">Open dashboard</Button>
          </Link>
        </div>

        {/* Inline stat row — each metric is shown only once it crosses its threshold */}
        {landingStats.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-8 text-sm">
            {landingStats.map((stat) => (
              <div key={stat.label}>
                <span className="text-2xl font-bold tabular-nums">{stat.value.toLocaleString()}</span>
                <span className="ml-2 text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>

      {/*
        REMOVED TRUST STRIP — 2026-06-13
        The following claims were displayed here and have been removed because
        none are backed by active enforcement in this codebase:
          • "SOC 2 Aware"               — no third-party audit performed
          • "HIPAA-Aware Architecture"  — no BAA process or enforcement wired in
          • "Clinician-Reviewed Protocols" — no clinical review workflow exists
        "Real Biomarker Data — No Simulations" was true but orphaned without
        the others; the Stats section below makes the same point more concretely.
        TODO: restore a trust strip only after the relevant certifications/
        processes are genuinely in place.
      */}

      <Stats />
      <Features />
      <Footer />
      <CookieConsent />
      </div>
    </AppShell>
  )
}
