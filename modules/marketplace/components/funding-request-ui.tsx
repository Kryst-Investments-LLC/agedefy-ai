"use client"

import { useMemo, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useMarketplaceEntity } from "@/modules/marketplace/hooks/use-marketplace-entity"
import { useMarketplaceWorkspace } from "@/modules/marketplace/hooks/use-marketplace-workspace"
import { formatCurrency } from "@/scientist-sponsor-marketplace/shared/utils"

export function FundingRequestUI() {
  const { snapshot, actingAs, refresh } = useMarketplaceWorkspace()
  const { runWorkflow, submitting } = useMarketplaceEntity(actingAs)
  const [form, setForm] = useState({
    discoveryId: snapshot.discoveries[0]?.id ?? "",
    requestedAmountCents: String(snapshot.fundingRequests[0]?.requestedAmountCents ?? 250000),
    useOfFunds: "Replication studies, regulatory packaging, biomarker validation, and diligence preparation.",
    timelineMonths: String(snapshot.fundingRequests[0]?.timelineMonths ?? 12),
  })
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const requestsByDiscovery = useMemo(() => {
    return new Map(snapshot.fundingRequests.map((request) => [request.discoveryId, request]))
  }, [snapshot.fundingRequests])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runWorkflow("scientist", {
      action: "setFundingNeeds",
      discoveryId: form.discoveryId,
      requestedAmountCents: Number(form.requestedAmountCents),
      useOfFunds: form.useOfFunds,
      timelineMonths: Number(form.timelineMonths),
    })
    setStatusMessage("Funding request saved.")
    await refresh()
  }

  return (
    <Card className="border-white/10 bg-slate-950/80 text-white">
      <CardHeader>
        <CardTitle>Funding Request UI</CardTitle>
        <CardDescription className="text-white/60">Package capital needs, timeline expectations, and fund-use narratives for sponsor diligence.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="funding-request-discovery">Discovery</Label>
            <select id="funding-request-discovery" className="h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm" value={form.discoveryId} onChange={(event) => setForm((current) => ({ ...current, discoveryId: event.target.value }))}>
              <option value="">Select discovery</option>
              {snapshot.discoveries.map((discovery) => (
                <option key={discovery.id} value={discovery.id}>{discovery.title}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="funding-request-amount">Requested amount (cents)</Label>
              <Input id="funding-request-amount" type="number" value={form.requestedAmountCents} onChange={(event) => setForm((current) => ({ ...current, requestedAmountCents: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="funding-request-timeline">Timeline (months)</Label>
              <Input id="funding-request-timeline" type="number" value={form.timelineMonths} onChange={(event) => setForm((current) => ({ ...current, timelineMonths: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="funding-request-use">Use of funds</Label>
            <Textarea id="funding-request-use" rows={6} value={form.useOfFunds} onChange={(event) => setForm((current) => ({ ...current, useOfFunds: event.target.value }))} />
          </div>
          <Button type="submit" className="bg-white text-slate-950 hover:bg-white/90" disabled={submitting || actingAs !== "scientist"}>Save funding request</Button>
          {actingAs !== "scientist" ? <p className="text-xs text-amber-200/80">Switch to the scientist role to edit funding requests.</p> : null}
          {statusMessage ? <p className="text-sm text-emerald-300">{statusMessage}</p> : null}
        </form>

        <div className="space-y-4">
          {snapshot.discoveries.length ? snapshot.discoveries.map((discovery) => {
            const request = requestsByDiscovery.get(discovery.id)

            return (
              <div key={discovery.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">{discovery.title}</p>
                    <p className="mt-1 text-sm text-white/55">{discovery.category} · {discovery.developmentStage}</p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">{request?.status ?? "No request"}</span>
                </div>
                {request ? (
                  <div className="mt-3 space-y-2 text-sm text-white/65">
                    <p>Amount {formatCurrency(request.requestedAmountCents)}</p>
                    <p>Timeline {request.timelineMonths} months</p>
                    <p>{request.useOfFunds}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-white/55">No funding request has been published for this discovery yet.</p>
                )}
              </div>
            )
          }) : <p className="text-sm text-white/55">Create a discovery before packaging funding needs.</p>}
        </div>
      </CardContent>
    </Card>
  )
}
