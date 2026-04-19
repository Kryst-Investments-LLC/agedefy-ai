"use client"

import Link from "next/link"
import { Lock, Shield, Stethoscope, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n/useTranslation"

interface LandingHeroProps {
  userCount: number
  biomarkerCount: number
  compoundCount: number
}

/**
 * Landing-page hero + trust strip.
 *
 * Wired to `useTranslation` so the language switcher visibly retitles the
 * home page in addition to the sidebar. The heading-stat numbers are
 * passed in from the server component (`app/page.tsx`) so this stays a
 * thin client wrapper without re-querying the database on every render.
 */
export function LandingHero({ userCount, biomarkerCount, compoundCount }: LandingHeroProps) {
  const { t } = useTranslation()

  function tr(key: string, fallback: string) {
    const v = t(key)
    return v === key ? fallback : v
  }

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="text-sm uppercase tracking-[0.2em] text-primary">
          {tr("landing.eyebrow", "The longevity intelligence platform")}
        </p>
        <h1 className="mt-4 max-w-4xl text-5xl font-bold leading-tight">
          {tr(
            "landing.headline",
            "Track biomarkers. Optimize protocols. Access longevity medicine — all in one platform.",
          )}
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
          {tr(
            "landing.description",
            "Biozephyra combines biomarker tracking, a curated compound knowledge graph, AI-assisted informational coaching, physician consultation workflows, lab testing, and a marketplace with tracked inventory and audit trails.",
          )}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/sign-up">
            <Button size="lg" className="text-lg px-6 py-3">
              {tr("landing.ctaPrimary", "Get started free")}
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="lg">
              {tr("landing.ctaSecondary", "View plans")}
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg">
              {tr("landing.ctaTertiary", "Open dashboard")}
            </Button>
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap gap-8 text-sm">
          <div>
            <span className="text-2xl font-bold tabular-nums">{userCount.toLocaleString()}</span>
            <span className="ml-2 text-muted-foreground">
              {tr("landing.statsUsers", "registered users")}
            </span>
          </div>
          <div>
            <span className="text-2xl font-bold tabular-nums">
              {biomarkerCount.toLocaleString()}
            </span>
            <span className="ml-2 text-muted-foreground">
              {tr("landing.statsBiomarkers", "biomarker readings")}
            </span>
          </div>
          <div>
            <span className="text-2xl font-bold tabular-nums">{compoundCount.toLocaleString()}</span>
            <span className="ml-2 text-muted-foreground">
              {tr("landing.statsCompounds", "compounds in graph")}
            </span>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 px-4 py-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span>{tr("landing.trustSoc2", "SOC 2 Aware")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span>{tr("landing.trustHipaa", "HIPAA-Aware Architecture")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <span>{tr("landing.trustClinician", "Clinician-Reviewed Protocols")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span>{tr("landing.trustRealData", "Real Biomarker Data — No Simulations")}</span>
          </div>
        </div>
      </section>
    </>
  )
}
