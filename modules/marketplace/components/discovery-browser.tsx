"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMarketplaceEntity } from "@/modules/marketplace/hooks/use-marketplace-entity"
import { useMarketplaceWorkspace } from "@/modules/marketplace/hooks/use-marketplace-workspace"
import { DISCOVERY_CATEGORIES, DISCOVERY_STAGES } from "@/scientist-sponsor-marketplace/shared/constants"
import { formatCurrency } from "@/scientist-sponsor-marketplace/shared/utils"

export function DiscoveryBrowser() {
  const { snapshot, actingAs, refresh } = useMarketplaceWorkspace()
  const { runWorkflow, submitting } = useMarketplaceEntity(actingAs)
  const [message, setMessage] = useState("We would like diligence materials, supporting evidence, and proposed milestone assumptions.")
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    stage: "",
    minImpactScore: "0.55",
  })
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const filteredDiscoveries = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    const minImpactScore = Number(filters.minImpactScore || 0)

    return snapshot.discoveries
      .filter((discovery) => discovery.status === "PUBLISHED")
      .filter((discovery) => (filters.category ? discovery.category === filters.category : true))
      .filter((discovery) => (filters.stage ? discovery.developmentStage === filters.stage : true))
      .filter((discovery) => discovery.scientificImpactScore >= minImpactScore)
      .filter((discovery) => {
        if (!search) {
          return true
        }

        return [discovery.title, discovery.summary, discovery.category, discovery.developmentStage]
          .join(" ")
          .toLowerCase()
          .includes(search)
      })
      .sort((left, right) => right.scientificImpactScore - left.scientificImpactScore)
  }, [filters, snapshot.discoveries])

  async function requestMoreInfo(discoveryId: string) {
    await runWorkflow("sponsor", { action: "requestMoreInfo", discoveryId, message })
    setStatusMessage("Diligence request sent.")
    await refresh()
  }

  async function enterDealRoom(discoveryId: string) {
    await runWorkflow("sponsor", { action: "enterDealRoom", discoveryId })
    setStatusMessage("Deal room opened.")
    await refresh()
  }

  return (
    <Card className="border-white/10 bg-slate-950/80 text-white">
      <CardHeader>
        <CardTitle>Discovery Browser</CardTitle>
        <CardDescription className="text-white/60">Search published opportunities, review scientific fit, and launch diligence from a single surface.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="marketplace-search">Search</Label>
            <Input id="marketplace-search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Target, mechanism, modality, dataset" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketplace-category">Category</Label>
            <select id="marketplace-category" className="h-10 rounded-md border border-white/10 bg-slate-900 px-3 text-sm" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
              <option value="">All categories</option>
              {DISCOVERY_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketplace-stage">Stage</Label>
            <select id="marketplace-stage" className="h-10 rounded-md border border-white/10 bg-slate-900 px-3 text-sm" value={filters.stage} onChange={(event) => setFilters((current) => ({ ...current, stage: event.target.value }))}>
              <option value="">All stages</option>
              {DISCOVERY_STAGES.map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="marketplace-impact">Minimum impact score</Label>
          <Input id="marketplace-impact" type="number" step="0.01" value={filters.minImpactScore} onChange={(event) => setFilters((current) => ({ ...current, minImpactScore: event.target.value }))} />
        </div>

        {actingAs === "sponsor" ? (
          <div className="space-y-2">
            <Label htmlFor="marketplace-request-message">Diligence request message</Label>
            <Input id="marketplace-request-message" value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
        ) : null}

        <div className="space-y-4">
          {filteredDiscoveries.length ? filteredDiscoveries.map((discovery) => (
            <div key={discovery.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">{discovery.category} · {discovery.developmentStage}</p>
                  <h3 className="mt-2 text-lg font-semibold">{discovery.title}</h3>
                  <p className="mt-2 max-w-3xl text-sm text-white/65">{discovery.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/55">
                    <span>Impact {Math.round(discovery.scientificImpactScore * 100)}%</span>
                    <span>Readiness {Math.round(discovery.commercialReadiness * 100)}%</span>
                    <span>Target raise {formatCurrency(discovery.fundingGoalCents)}</span>
                  </div>
                </div>
                {actingAs === "sponsor" ? (
                  <div className="flex flex-col gap-3">
                    <Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => void requestMoreInfo(discovery.id)} disabled={submitting}>Request more info</Button>
                    <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => void enterDealRoom(discovery.id)} disabled={submitting}>Open deal room</Button>
                  </div>
                ) : null}
              </div>
            </div>
          )) : <p className="text-sm text-white/55">No published discoveries match the current filter set.</p>}
        </div>

        {statusMessage ? <p className="text-sm text-emerald-300">{statusMessage}</p> : null}
      </CardContent>
    </Card>
  )
}
