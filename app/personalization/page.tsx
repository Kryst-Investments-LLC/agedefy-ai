// CI-008: reads required data from the database — force dynamic rendering so
// the DB is queried at request time, never at build (a DB failure can then
// never be swallowed into a statically-generated page).
export const dynamic = "force-dynamic"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { AIHealthCoach } from "@/components/ai-health-coach"
import { AppShell } from "@/components/app-shell"
import { SafetyEvidenceTrail, type LatestAnalysis } from "@/components/safety-evidence-trail"
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

  // Evidence trail for the coach's recommendations (deterministic safety + citations).
  const latestSession = await db.agentSession.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, goal: true, status: true, result: true, createdAt: true },
  })
  let latestAnalysis: LatestAnalysis | null = null
  if (latestSession) {
    const claims = await db.agentClaim.findMany({
      where: { sessionId: latestSession.id },
      select: { claimText: true, evidenceKind: true, confidence: true },
      orderBy: { confidence: "desc" },
      take: 6,
    })
    let safetyFlagCount = 0
    try {
      const parsed = latestSession.result ? (JSON.parse(latestSession.result) as { safetyFlags?: unknown[] }) : null
      if (Array.isArray(parsed?.safetyFlags)) safetyFlagCount = parsed.safetyFlags.length
    } catch {
      /* result not JSON */
    }
    latestAnalysis = {
      goal: latestSession.goal,
      status: latestSession.status,
      createdAt: latestSession.createdAt.toISOString(),
      safetyFlagCount,
      requiresReview: latestSession.status === "AWAITING_REVIEW",
      citations: claims.map((c) => ({
        claimText: c.claimText,
        evidenceKind: String(c.evidenceKind),
        confidence: c.confidence,
      })),
    }
  }

  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10 text-foreground">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">Premium feature</p>
          <h1 className="mt-3 text-4xl font-bold">AI Personalization</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Get AI-assisted informational summaries informed by your tracked biomarkers and protocols.
            Use it to explore compounds, pathways, and questions to review with a clinician.
          </p>
        </div>

        {/* Trust moat — safety + citation evidence trail */}
        <div className="mb-8">
          <SafetyEvidenceTrail latest={latestAnalysis} />
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
    </AppShell>
  )
}

