import type { Metadata } from "next"
import { getServerSession } from "next-auth"

import { AppShell } from "@/components/app-shell"
import { AggregateOutcomeCards } from "@/components/insights/aggregate-outcomes"
import { EffectReadout } from "@/components/effect-readout"
import { authOptions } from "@/lib/auth"
import { getLatestProtocolEffect } from "@/lib/outcomes/latest-effect"

export const metadata: Metadata = {
  title: "Population Insights — Biozephyra",
  description:
    "Anonymised, privacy-preserving population-level outcome insights from the Biozephyra community.",
  openGraph: {
    title: "Population Insights — Biozephyra",
    description:
      "See what protocols and compounds are working best across the Biozephyra community.",
  },
}

export default async function InsightsPage() {
  const session = await getServerSession(authOptions)
  const personalEffect = session?.user?.id ? await getLatestProtocolEffect(session.user.id) : null

  return (
    <AppShell pageTitle="Insights">
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Insights</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Your measured protocol effects, plus anonymised population-level outcomes
          aggregated with k-anonymity (k≥5) and differential privacy.
        </p>
      </div>

      {/* Your measured effect — the personal causal readout */}
      {personalEffect && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Your latest measured effect</h2>
          <EffectReadout effect={personalEffect} />
        </section>
      )}

      {/* Privacy banner */}
      <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-4">
        <h2 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">
          Privacy Guarantees
        </h2>
        <ul className="text-sm text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
          <li>
            <strong>k-Anonymity (k≥5):</strong> Each cohort bucket contains at
            least 5 individuals. Smaller groups are suppressed.
          </li>
          <li>
            <strong>Differential Privacy:</strong> Laplace noise is added to all
            aggregate statistics before display.
          </li>
          <li>
            <strong>Consent-gated:</strong> Only data from users who granted
            &quot;Research Data Usage&quot; consent is included.
          </li>
        </ul>
      </div>

      {/* Aggregate outcome cards */}
      <section>
        <h2 className="text-xl font-semibold mb-4">
          Top Protocols &amp; Compounds
        </h2>
        <AggregateOutcomeCards />
      </section>

      {/* How it works */}
      <section className="rounded-lg border p-6 space-y-3">
        <h2 className="text-lg font-semibold">How the Outcome Flywheel Works</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>
            Users track biomarkers and protocol outcomes through Biozephyra.
          </li>
          <li>
            Users who opt in via &quot;Research Data Usage&quot; consent contribute
            anonymised outcome data.
          </li>
          <li>
            Nightly aggregation applies k-anonymity and differential privacy
            noise to compute population-level statistics.
          </li>
          <li>
            Aggregate insights are displayed here and used to boost
            recommendation confidence for matching cohorts.
          </li>
          <li>
            As more users participate, insights become more accurate —
            creating a virtuous data flywheel.
          </li>
        </ol>
      </section>
    </div>
    </AppShell>
  )
}
