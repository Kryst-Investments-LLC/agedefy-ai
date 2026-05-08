import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { Navigation } from "@/components/navigation"
import { LabTestingDashboard } from "@/components/lab-testing-dashboard"
import { authOptions } from "@/lib/auth"
import { hasPremiumEntitlement } from "@/lib/entitlements"

export default async function LabTestingPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !(await hasPremiumEntitlement(session.user.id))) {
    redirect("/pricing?required=lab-testing")
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Lab Testing</h1>
        <p className="text-gray-400 text-sm mb-8">
          Order longevity-focused blood panels, track results, and integrate with your biomarker dashboard.
        </p>
        <LabTestingDashboard />
      </main>
    </div>
  )
}
