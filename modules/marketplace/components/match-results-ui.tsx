"use client"

import { useMemo } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useMarketplaceWorkspace } from "@/modules/marketplace/hooks/use-marketplace-workspace"

export function MatchResultsUI() {
  const { snapshot, actingAs } = useMarketplaceWorkspace()

  const matches = useMemo(() => {
    const source = actingAs === "sponsor" ? snapshot.sponsorMatchScores : snapshot.scientistMatchScores
    return [...source].sort((left, right) => right.overallScore - left.overallScore)
  }, [actingAs, snapshot.scientistMatchScores, snapshot.sponsorMatchScores])

  return (
    <Card className="border-white/10 bg-slate-950/80 text-white">
      <CardHeader>
        <CardTitle>Match Results UI</CardTitle>
        <CardDescription className="text-white/60">Review rule-based and AI-augmented fit signals across the current marketplace pipeline.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {matches.length ? matches.map((match) => (
          <div key={match.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">Match #{match.rank ?? "-"}</p>
                <p className="text-sm text-white/55">Discovery {match.discoveryId} · Sponsor {match.sponsorId}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-cyan-200">{Math.round(match.overallScore * 100)}%</p>
                <p className="text-xs text-white/45">Rule {Math.round(match.ruleBasedScore * 100)}% · Text similarity {Math.round((match.aiAugmentedScore ?? 0) * 100)}%</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/65">{match.rationale}</p>
            <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6 text-xs text-white/55">
              <span>Category {Math.round(match.weightedBreakdown.categoryFit * 100)}%</span>
              <span>Budget {Math.round(match.weightedBreakdown.budgetFit * 100)}%</span>
              <span>Impact {Math.round(match.weightedBreakdown.impactFit * 100)}%</span>
              <span>Stage {Math.round(match.weightedBreakdown.stageFit * 100)}%</span>
              <span>Evidence {Math.round(match.weightedBreakdown.evidenceFit * 100)}%</span>
              <span>Metadata {Math.round(match.weightedBreakdown.metadataFit * 100)}%</span>
            </div>
          </div>
        )) : <p className="text-sm text-white/55">No match scores are available for the current role and workspace state.</p>}
      </CardContent>
    </Card>
  )
}
