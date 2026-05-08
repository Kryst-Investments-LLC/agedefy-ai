"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useMarketplaceEntity } from "@/scientist-sponsor-marketplace/frontend/hooks/use-marketplace-entity"
import { useMarketplaceWorkspace } from "@/scientist-sponsor-marketplace/frontend/hooks/use-marketplace-workspace"
import { DISCOVERY_CATEGORIES, DISCOVERY_STAGES } from "@/scientist-sponsor-marketplace/shared/constants"
import { formatCurrency } from "@/scientist-sponsor-marketplace/shared/utils"

export function ScientistDashboard() {
  const { snapshot, actingAs, refresh } = useMarketplaceWorkspace()
  const { runWorkflow, submitting } = useMarketplaceEntity(actingAs)
  const [message, setMessage] = useState<string | null>(null)
  const [discoveryForm, setDiscoveryForm] = useState<{
    title: string
    category: string
    summary: string
    developmentStage: string
    scientificImpactScore: string
    commercialReadiness: string
    fundingGoalCents: string
    evidenceSummary: string
  }>({
    title: "",
    category: DISCOVERY_CATEGORIES[0],
    summary: "",
    developmentStage: DISCOVERY_STAGES[0],
    scientificImpactScore: "0.72",
    commercialReadiness: "0.46",
    fundingGoalCents: "250000",
    evidenceSummary: "",
  })
  const [fundingForm, setFundingForm] = useState({
    discoveryId: snapshot.discoveries[0]?.id ?? "",
    requestedAmountCents: "250000",
    useOfFunds: "Run replication studies, secure translational biomarkers, and package diligence materials.",
    timelineMonths: "12",
  })
  const [evidenceForm, setEvidenceForm] = useState({
    discoveryId: snapshot.discoveries[0]?.id ?? "",
    label: "Primary preprint",
    url: "https://example.com/preprint",
    evidenceType: "preprint",
  })

  const scientistDeals = snapshot.dealRooms.filter((dealRoom) => dealRoom.scientistId === snapshot.scientist?.id)
  const scientistMatches = snapshot.scientistMatchScores.filter((match) => match.scientistId === snapshot.scientist?.id)

  async function createDiscovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runWorkflow("scientist", {
      action: "createDiscovery",
      ...discoveryForm,
      scientificImpactScore: Number(discoveryForm.scientificImpactScore),
      commercialReadiness: Number(discoveryForm.commercialReadiness),
      fundingGoalCents: Number(discoveryForm.fundingGoalCents),
    })
    setMessage("Discovery created.")
    setDiscoveryForm({ ...discoveryForm, title: "", summary: "", evidenceSummary: "" })
    await refresh()
  }

  async function createFundingRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runWorkflow("scientist", {
      action: "setFundingNeeds",
      discoveryId: fundingForm.discoveryId,
      requestedAmountCents: Number(fundingForm.requestedAmountCents),
      useOfFunds: fundingForm.useOfFunds,
      timelineMonths: Number(fundingForm.timelineMonths),
    })
    setMessage("Funding request saved.")
    await refresh()
  }

  async function uploadEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runWorkflow("scientist", {
      action: "uploadEvidence",
      discoveryId: evidenceForm.discoveryId,
      evidence: {
        label: evidenceForm.label,
        url: evidenceForm.url,
        evidenceType: evidenceForm.evidenceType,
      },
    })
    setMessage("Evidence attached.")
    await refresh()
  }

  async function publishDiscovery(discoveryId: string) {
    await runWorkflow("scientist", { action: "publish", discoveryId })
    setMessage("Discovery published to marketplace.")
    await refresh()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
      <div className="space-y-6">
        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Create Discovery</CardTitle>
            <CardDescription className="text-white/60">Launch a new scientific asset into the marketplace pipeline.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={createDiscovery}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="discovery-title">Title</Label>
                  <Input id="discovery-title" value={discoveryForm.title} onChange={(event) => setDiscoveryForm((current) => ({ ...current, title: event.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discovery-category">Category</Label>
                  <select id="discovery-category" className="h-10 rounded-md border border-white/10 bg-slate-900 px-3 text-sm" value={discoveryForm.category} onChange={(event) => setDiscoveryForm((current) => ({ ...current, category: event.target.value }))}>
                    {DISCOVERY_CATEGORIES.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discovery-stage">Stage</Label>
                  <select id="discovery-stage" className="h-10 rounded-md border border-white/10 bg-slate-900 px-3 text-sm" value={discoveryForm.developmentStage} onChange={(event) => setDiscoveryForm((current) => ({ ...current, developmentStage: event.target.value }))}>
                    {DISCOVERY_STAGES.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="discovery-summary">Summary</Label>
                  <Textarea id="discovery-summary" value={discoveryForm.summary} onChange={(event) => setDiscoveryForm((current) => ({ ...current, summary: event.target.value }))} rows={5} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scientific-impact">Impact score</Label>
                  <Input id="scientific-impact" type="number" step="0.01" value={discoveryForm.scientificImpactScore} onChange={(event) => setDiscoveryForm((current) => ({ ...current, scientificImpactScore: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commercial-readiness">Readiness score</Label>
                  <Input id="commercial-readiness" type="number" step="0.01" value={discoveryForm.commercialReadiness} onChange={(event) => setDiscoveryForm((current) => ({ ...current, commercialReadiness: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="funding-goal">Funding goal (cents)</Label>
                  <Input id="funding-goal" type="number" value={discoveryForm.fundingGoalCents} onChange={(event) => setDiscoveryForm((current) => ({ ...current, fundingGoalCents: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evidence-summary">Evidence summary</Label>
                  <Input id="evidence-summary" value={discoveryForm.evidenceSummary} onChange={(event) => setDiscoveryForm((current) => ({ ...current, evidenceSummary: event.target.value }))} />
                </div>
              </div>
              <Button type="submit" className="w-fit bg-cyan-500 text-slate-950 hover:bg-cyan-400" disabled={submitting}>Create discovery</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Published Portfolio</CardTitle>
            <CardDescription className="text-white/60">Manage evidence, funding needs, and live sponsor interest.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.discoveries.length ? snapshot.discoveries.map((discovery) => (
              <div key={discovery.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">{discovery.category} · {discovery.developmentStage}</p>
                    <h3 className="mt-2 text-xl font-semibold">{discovery.title}</h3>
                    <p className="mt-2 max-w-3xl text-sm text-white/65">{discovery.summary}</p>
                    <p className="mt-3 text-sm text-white/50">Target raise {formatCurrency(discovery.fundingGoalCents)} · Status {discovery.status.toLowerCase()}</p>
                  </div>
                  <Button variant="outline" className="border-cyan-400/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20" onClick={() => void publishDiscovery(discovery.id)} disabled={submitting || discovery.status === "PUBLISHED"}>
                    {discovery.status === "PUBLISHED" ? "Published" : "Publish"}
                  </Button>
                </div>
              </div>
            )) : <p className="text-sm text-white/55">No discoveries created yet.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Funding Needs</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createFundingRequest}>
              <div className="space-y-2">
                <Label htmlFor="funding-discovery">Discovery</Label>
                <select id="funding-discovery" className="h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm" value={fundingForm.discoveryId} onChange={(event) => setFundingForm((current) => ({ ...current, discoveryId: event.target.value }))}>
                  <option value="">Select discovery</option>
                  {snapshot.discoveries.map((discovery) => (
                    <option key={discovery.id} value={discovery.id}>{discovery.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="funding-amount">Requested amount (cents)</Label>
                <Input id="funding-amount" type="number" value={fundingForm.requestedAmountCents} onChange={(event) => setFundingForm((current) => ({ ...current, requestedAmountCents: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="funding-timeline">Timeline (months)</Label>
                <Input id="funding-timeline" type="number" value={fundingForm.timelineMonths} onChange={(event) => setFundingForm((current) => ({ ...current, timelineMonths: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="funding-use">Use of funds</Label>
                <Textarea id="funding-use" value={fundingForm.useOfFunds} onChange={(event) => setFundingForm((current) => ({ ...current, useOfFunds: event.target.value }))} rows={4} />
              </div>
              <Button type="submit" className="w-full bg-white text-slate-950 hover:bg-white/90" disabled={submitting}>Save funding request</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Evidence Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={uploadEvidence}>
              <div className="space-y-2">
                <Label htmlFor="evidence-discovery">Discovery</Label>
                <select id="evidence-discovery" className="h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm" value={evidenceForm.discoveryId} onChange={(event) => setEvidenceForm((current) => ({ ...current, discoveryId: event.target.value }))}>
                  <option value="">Select discovery</option>
                  {snapshot.discoveries.map((discovery) => (
                    <option key={discovery.id} value={discovery.id}>{discovery.title}</option>
                  ))}
                </select>
              </div>
              <Input value={evidenceForm.label} onChange={(event) => setEvidenceForm((current) => ({ ...current, label: event.target.value }))} placeholder="Evidence label" />
              <Input value={evidenceForm.url} onChange={(event) => setEvidenceForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." />
              <Input value={evidenceForm.evidenceType} onChange={(event) => setEvidenceForm((current) => ({ ...current, evidenceType: event.target.value }))} placeholder="preprint, dataset, protocol" />
              <Button type="submit" variant="outline" className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10" disabled={submitting}>Attach evidence</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Market Signal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scientistMatches.length ? scientistMatches.slice(0, 6).map((match) => (
              <div key={match.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">Match score</p>
                  <p className="text-sm text-cyan-200">{Math.round(match.overallScore * 100)}%</p>
                </div>
                <p className="mt-2 text-sm text-white/60">{match.rationale}</p>
              </div>
            )) : <p className="text-sm text-white/55">Sponsor fit scores appear once published discoveries are ranked.</p>}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Deal Rooms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scientistDeals.length ? scientistDeals.map((dealRoom) => (
              <div key={dealRoom.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                <p className="font-medium text-white">{dealRoom.status.toLowerCase()} · {dealRoom.agreementStatus.toLowerCase()}</p>
                <p className="mt-1">Last activity {new Date(dealRoom.lastActivityAt).toLocaleString()}</p>
              </div>
            )) : <p className="text-sm text-white/55">No active sponsor conversations yet.</p>}
            {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
