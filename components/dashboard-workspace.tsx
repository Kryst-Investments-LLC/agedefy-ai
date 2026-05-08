"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type BiomarkerRecord = {
  id: string
  name: string
  value: number
  unit: string
  target: number | null
  trend: "UP" | "DOWN" | "STABLE"
  measuredAt: string
}

type ProtocolRecord = {
  id: string
  name: string
  description: string | null
  status: string
  updatedAt: string
}

type DashboardWorkspaceProps = {
  biomarkers: BiomarkerRecord[]
  protocols: ProtocolRecord[]
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error ?? "Request failed")
  }

  return body
}

export function DashboardWorkspace({ biomarkers, protocols }: DashboardWorkspaceProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [biomarkerError, setBiomarkerError] = useState<string | null>(null)
  const [protocolError, setProtocolError] = useState<string | null>(null)
  const [biomarkerForm, setBiomarkerForm] = useState({
    name: "",
    value: "",
    unit: "",
    target: "",
    trend: "STABLE",
  })
  const [protocolForm, setProtocolForm] = useState({
    name: "",
    status: "draft",
    description: "",
  })

  const refresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const createBiomarker = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBiomarkerError(null)

    try {
      await requestJson("/api/biomarkers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...biomarkerForm,
          value: biomarkerForm.value,
          target: biomarkerForm.target,
        }),
      })
      setBiomarkerForm({ name: "", value: "", unit: "", target: "", trend: "STABLE" })
      refresh()
    } catch (error) {
      setBiomarkerError(error instanceof Error ? error.message : "Unable to save biomarker")
    }
  }

  const deleteBiomarker = async (id: string) => {
    setBiomarkerError(null)

    try {
      await requestJson(`/api/biomarkers/${id}`, { method: "DELETE" })
      refresh()
    } catch (error) {
      setBiomarkerError(error instanceof Error ? error.message : "Unable to delete biomarker")
    }
  }

  const createProtocol = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProtocolError(null)

    try {
      await requestJson("/api/protocols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(protocolForm),
      })
      setProtocolForm({ name: "", status: "draft", description: "" })
      refresh()
    } catch (error) {
      setProtocolError(error instanceof Error ? error.message : "Unable to save protocol")
    }
  }

  const deleteProtocol = async (id: string) => {
    setProtocolError(null)

    try {
      await requestJson(`/api/protocols/${id}`, { method: "DELETE" })
      refresh()
    } catch (error) {
      setProtocolError(error instanceof Error ? error.message : "Unable to delete protocol")
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Biomarkers</h2>
            <p className="mt-1 text-sm text-gray-400">Store real measured biomarker values in your workspace.</p>
          </div>
          {isPending ? <span className="text-sm text-gray-500">Refreshing...</span> : null}
        </div>

        <form className="mt-6 space-y-4" onSubmit={createBiomarker}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="biomarker-name">Name</Label>
              <Input
                id="biomarker-name"
                value={biomarkerForm.name}
                onChange={(event) => setBiomarkerForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="HbA1c"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biomarker-unit">Unit</Label>
              <Input
                id="biomarker-unit"
                value={biomarkerForm.unit}
                onChange={(event) => setBiomarkerForm((current) => ({ ...current, unit: event.target.value }))}
                placeholder="%"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biomarker-value">Value</Label>
              <Input
                id="biomarker-value"
                type="number"
                step="0.01"
                value={biomarkerForm.value}
                onChange={(event) => setBiomarkerForm((current) => ({ ...current, value: event.target.value }))}
                placeholder="5.2"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biomarker-target">Target</Label>
              <Input
                id="biomarker-target"
                type="number"
                step="0.01"
                value={biomarkerForm.target}
                onChange={(event) => setBiomarkerForm((current) => ({ ...current, target: event.target.value }))}
                placeholder="5.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="biomarker-trend">Trend</Label>
            <select
              id="biomarker-trend"
              className="flex h-10 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white"
              value={biomarkerForm.trend}
              onChange={(event) =>
                setBiomarkerForm((current) => ({ ...current, trend: event.target.value as "UP" | "DOWN" | "STABLE" }))
              }
            >
              <option value="STABLE">Stable</option>
              <option value="UP">Up</option>
              <option value="DOWN">Down</option>
            </select>
          </div>

          {biomarkerError ? <p className="text-sm text-red-400">{biomarkerError}</p> : null}
          <Button type="submit" className="bg-teal-600 hover:bg-teal-700">Add biomarker</Button>
        </form>

        <div className="mt-6 space-y-3">
          {biomarkers.length ? (
            biomarkers.map((biomarker) => (
              <div key={biomarker.id} className="rounded-xl border border-gray-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{biomarker.name}</p>
                    <p className="mt-1 text-sm text-gray-400">
                      {biomarker.value} {biomarker.unit}
                      {biomarker.target !== null ? `, target ${biomarker.target} ${biomarker.unit}` : ""}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">{biomarker.trend}</p>
                  </div>
                  <Button variant="outline" className="border-gray-700 text-gray-200 hover:bg-gray-800" onClick={() => deleteBiomarker(biomarker.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No biomarker records yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold">Protocols</h2>
        <p className="mt-1 text-sm text-gray-400">Create and manage real protocol records instead of simulated stacks.</p>

        <form className="mt-6 space-y-4" onSubmit={createProtocol}>
          <div className="space-y-2">
            <Label htmlFor="protocol-name">Name</Label>
            <Input
              id="protocol-name"
              value={protocolForm.name}
              onChange={(event) => setProtocolForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Baseline metabolic protocol"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="protocol-status">Status</Label>
            <select
              id="protocol-status"
              className="flex h-10 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white"
              value={protocolForm.status}
              onChange={(event) => setProtocolForm((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="protocol-description">Description</Label>
            <Textarea
              id="protocol-description"
              value={protocolForm.description}
              onChange={(event) => setProtocolForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Track scope, intent, monitoring cadence, and clinical guardrails."
            />
          </div>
          {protocolError ? <p className="text-sm text-red-400">{protocolError}</p> : null}
          <Button type="submit" className="bg-teal-600 hover:bg-teal-700">Create protocol</Button>
        </form>

        <div className="mt-6 space-y-3">
          {protocols.length ? (
            protocols.map((protocol) => (
              <div key={protocol.id} className="rounded-xl border border-gray-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{protocol.name}</p>
                    <p className="mt-1 text-sm text-gray-400">{protocol.description ?? "No description"}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">{protocol.status}</p>
                  </div>
                  <Button variant="outline" className="border-gray-700 text-gray-200 hover:bg-gray-800" onClick={() => deleteProtocol(protocol.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No protocol records yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}