import Link from "next/link"

import { Features } from "@/components/features"
import { Stats } from "@/components/stats"
import { Footer } from "@/components/footer"
import { CookieConsent } from "@/components/cookie-consent"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Shield, Stethoscope, Lock, Activity } from "lucide-react"
import { db } from "@/lib/db"

export default async function HomePage() {
  const [userCount, biomarkerCount, compoundCount] = await Promise.all([
    db.user.count(),
    db.biomarker.count(),
    db.compound.count(),
  ])

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <Navigation />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="text-sm uppercase tracking-[0.2em] text-primary">The longevity intelligence platform</p>
        <h1 className="mt-4 max-w-4xl text-5xl font-bold leading-tight">
          Track biomarkers. Optimize protocols. Access longevity medicine — all in one platform.
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

        {/* Inline stat row */}
        <div className="mt-12 flex flex-wrap gap-8 text-sm">
          <div>
            <span className="text-2xl font-bold tabular-nums">{userCount.toLocaleString()}</span>
            <span className="ml-2 text-muted-foreground">registered users</span>
          </div>
          <div>
            <span className="text-2xl font-bold tabular-nums">{biomarkerCount.toLocaleString()}</span>
            <span className="ml-2 text-muted-foreground">biomarker readings</span>
          </div>
          <div>
            <span className="text-2xl font-bold tabular-nums">{compoundCount.toLocaleString()}</span>
            <span className="ml-2 text-muted-foreground">compounds in graph</span>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 px-4 py-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span>SOC 2 Aware</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span>HIPAA-Aware Architecture</span>
          </div>
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <span>Clinician-Reviewed Protocols</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span>Real Biomarker Data — No Simulations</span>
          </div>
        </div>
      </section>

      <Stats />
      <Features />
      <Footer />
      <CookieConsent />
    </div>
  )
}
