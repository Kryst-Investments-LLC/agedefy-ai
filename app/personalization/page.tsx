import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { AIHealthCoach } from "@/components/ai-health-coach"
import { Navigation } from "@/components/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { authOptions } from "@/lib/auth"
import { hasPremiumEntitlement } from "@/lib/entitlements"
import { db } from "@/lib/db"

export default async function PersonalizationPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !(await hasPremiumEntitlement(session.user.id))) {
    redirect("/pricing?required=personalization")
  }

  // Fetch user's biomarker context for personalization
  const [biomarkerCount, latestBiomarkers, protocolCount] = await Promise.all([
    db.biomarker.count({ where: { userId: session.user.id } }),
    db.biomarker.findMany({
      where: { userId: session.user.id },
      orderBy: { measuredAt: "desc" },
      take: 10,
      select: { name: true, value: true, unit: true, trend: true },
    }),
    db.protocol.count({ where: { userId: session.user.id } }),
  ])

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-10 text-white">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">Premium feature</p>
          <h1 className="mt-3 text-4xl font-bold">AI Personalization</h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            Get AI-assisted informational summaries informed by your tracked biomarkers and protocols.
            Use it to explore compounds, pathways, and questions to review with a clinician.
          </p>
        </div>

        {/* Context summary */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Your Context</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{biomarkerCount} biomarkers</p>
              <p className="text-sm text-muted-foreground">{protocolCount} protocols tracked</p>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Recent Biomarkers</CardTitle>
            </CardHeader>
            <CardContent>
              {latestBiomarkers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No biomarkers tracked yet. Add biomarkers from your Dashboard to get personalized context.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {latestBiomarkers.map((b, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {b.name}: {b.value} {b.unit}
                      {b.trend && <span className="ml-1 opacity-60">({b.trend.toLowerCase()})</span>}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <AIHealthCoach />
      </main>
    </div>
  )
}

