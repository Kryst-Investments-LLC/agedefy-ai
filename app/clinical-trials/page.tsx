import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { ClinicalTrialsExplorer } from "@/components/clinical-trials-explorer"
import { Navigation } from "@/components/navigation"
import { authOptions } from "@/lib/auth"
import { hasPremiumEntitlement } from "@/lib/entitlements"

export default async function ClinicalTrialsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !(await hasPremiumEntitlement(session.user.id))) {
    redirect("/pricing?required=clinical-trials")
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-10 text-white">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">Premium feature</p>
          <h1 className="mt-3 text-4xl font-bold">Clinical Trials Explorer</h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            Search active clinical trials from ClinicalTrials.gov focused on aging, longevity, and anti-aging interventions. 
            Results are fetched in real time from the official government registry.
          </p>
        </div>
        <ClinicalTrialsExplorer />
      </main>
    </div>
  )
}

