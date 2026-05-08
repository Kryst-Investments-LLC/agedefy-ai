"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMarketplaceEntity } from "@/scientist-sponsor-marketplace/frontend/hooks/use-marketplace-entity"
import { useMarketplaceWorkspace } from "@/scientist-sponsor-marketplace/frontend/hooks/use-marketplace-workspace"
import type { Discovery, RankedMatch } from "@/scientist-sponsor-marketplace/shared/types/entities"
import { DISCOVERY_CATEGORIES, DISCOVERY_STAGES } from "@/scientist-sponsor-marketplace/shared/constants"
import { formatCurrency } from "@/scientist-sponsor-marketplace/shared/utils"

export function SponsorDashboard() {
  const { snapshot, actingAs, refresh } = useMarketplaceWorkspace()
  const { runWorkflow, submitting } = useMarketplaceEntity(actingAs)
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [recommendations, setRecommendations] = useState<RankedMatch[]>([])
  const [requestMessage, setRequestMessage] = useState("We would like diligence materials, milestone evidence, and proposed agreement assumptions.")
  const [filters, setFilters] = useState({
    category: "",
    stage: "",
    maxCostCents: "",
    minImpactScore: "0.55",
    search: "",
  })

  async function load() {
    const browseResponse = await runWorkflow("sponsor", {
      action: "browse",
      category: filters.category || undefined,
      stage: filters.stage || undefined,
      maxCostCents: filters.maxCostCents || undefined,
      minImpactScore: filters.minImpactScore || undefined,
      search: filters.search || undefined,
    })
    setDiscoveries(browseResponse)

    const response = await fetch(`/api/scientist-sponsor-marketplace/matches?category=${encodeURIComponent(filters.category)}&minImpactScore=${encodeURIComponent(filters.minImpactScore)}`)
    if (response.ok) {
      setRecommendations(await response.json())
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function requestMoreInfo(discoveryId: string) {
    await runWorkflow("sponsor", { action: "requestMoreInfo", discoveryId, message: requestMessage })
    await refresh()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Discovery Filters</CardTitle>
            <CardDescription className="text-white/60">Screen by category, cost, impact, and search terms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <select className="h-10 rounded-md border border-white/10 bg-slate-900 px-3 text-sm" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
                  <option value="">All</option>
                  {DISCOVERY_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Stage</Label>
                <select className="h-10 rounded-md border border-white/10 bg-slate-900 px-3 text-sm" value={filters.stage} onChange={(event) => setFilters((current) => ({ ...current, stage: event.target.value }))}>
                  <option value="">All</option>
                  {DISCOVERY_STAGES.map((stage) => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Max cost (cents)</Label>
                <Input value={filters.maxCostCents} onChange={(event) => setFilters((current) => ({ ...current, maxCostCents: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Min impact</Label>
                <Input value={filters.minImpactScore} onChange={(event) => setFilters((current) => ({ ...current, minImpactScore: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Search</Label>
                <Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
              </div>
            </div>
            <Button className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => void load()} disabled={submitting}>Refresh pipeline</Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Recommended Matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.length ? recommendations.slice(0, 5).map((match) => (
              <div key={match.discovery.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{match.discovery.title}</p>
                    <p className="text-sm text-white/55">{match.discovery.category} · {match.discovery.developmentStage}</p>
                  </div>
                  <p className="text-lg font-semibold text-cyan-200">{Math.round(match.overallScore * 100)}%</p>
                </div>
                <p className="mt-2 text-sm text-white/65">{match.rationale}</p>
              </div>
            )) : <p className="text-sm text-white/55">Recommendations will populate after at least one discovery is published.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-slate-950/80 text-white">
        <CardHeader>
          <CardTitle>Browse Discoveries</CardTitle>
          <CardDescription className="text-white/60">Request more information or enter a deal room for diligence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Request message</Label>
            <Input value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} />
          </div>
          {discoveries.length ? discoveries.map((discovery) => (
            <div key={discovery.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">{discovery.category} · {discovery.developmentStage}</p>
                  <h3 className="mt-2 text-xl font-semibold">{discovery.title}</h3>
                  <p className="mt-2 text-sm text-white/65">{discovery.summary}</p>
                  <p className="mt-3 text-sm text-white/50">Target raise {formatCurrency(discovery.fundingGoalCents)} · Impact {Math.round(discovery.scientificImpactScore * 100)}%</p>
                </div>
                <div className="flex flex-col gap-3">
                  <Button className="bg-amber-400 text-slate-950 hover:bg-amber-300" onClick={() => void requestMoreInfo(discovery.id)} disabled={submitting}>Request more info</Button>
                  <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => void runWorkflow("sponsor", { action: "enterDealRoom", discoveryId: discovery.id }).then(() => refresh())} disabled={submitting}>Enter deal room</Button>
                </div>
              </div>
            </div>
          )) : <p className="text-sm text-white/55">No published discoveries match the current filter set.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
