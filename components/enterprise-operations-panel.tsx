"use client"

import { ClinicianTaskStatus, PartnerDataSource, ResearchSource } from "@prisma/client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/* ── Types ─────────────────────────────────────────────── */

type ResearchEntryRecord = {
  id: string
  source: ResearchSource
  externalId: string | null
  title: string
  authors: string | null
  url: string | null
  publishedAt: string | null
}

type ClinicianTaskRecord = {
  id: string
  title: string
  description: string | null
  status: ClinicianTaskStatus
  priority: number
  dueAt: string | null
  createdAt: string
}

type PartnerDataRecordItem = {
  id: string
  source: PartnerDataSource
  partnerId: string | null
  label: string
  receivedAt: string
}

type Props = {
  researchEntries: ResearchEntryRecord[]
  clinicianTasks: ClinicianTaskRecord[]
  partnerRecords: PartnerDataRecordItem[]
}

/* ── Helpers ───────────────────────────────────────────── */

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error ?? "Request failed")
  return body
}

/* ── Component ─────────────────────────────────────────── */

export function EnterpriseOperationsPanel({ researchEntries, clinicianTasks, partnerRecords }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  /* research ingest form */
  const [researchQuery, setResearchQuery] = useState("")
  const [collectionName, setCollectionName] = useState("")

  /* clinical trials ingest form */
  const [ctQuery, setCtQuery] = useState("")
  const [ctCollectionName, setCtCollectionName] = useState("")

  /* clinician task form */
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDescription, setTaskDescription] = useState("")

  /* partner data form */
  const [partnerSource, setPartnerSource] = useState<PartnerDataSource>(PartnerDataSource.LAB)
  const [partnerLabel, setPartnerLabel] = useState("")
  const [partnerPayload, setPartnerPayload] = useState("")

  const refresh = () => startTransition(() => router.refresh())

  const ingestResearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await requestJson("/api/research/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionName, query: researchQuery, maxResults: 10 }),
      })
      setResearchQuery("")
      setCollectionName("")
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research ingest failed")
    }
  }

  const ingestClinicalTrials = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await requestJson("/api/research/clinical-trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionName: ctCollectionName, query: ctQuery, maxResults: 10 }),
      })
      setCtQuery("")
      setCtCollectionName("")
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clinical trials ingest failed")
    }
  }

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await requestJson("/api/clinician-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle, description: taskDescription || undefined }),
      })
      setTaskTitle("")
      setTaskDescription("")
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task creation failed")
    }
  }

  const updateTaskStatus = async (id: string, status: ClinicianTaskStatus) => {
    setError(null)
    try {
      await requestJson("/api/clinician-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task update failed")
    }
  }

  const submitPartnerData = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await requestJson("/api/partner-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: partnerSource, label: partnerLabel, payload: partnerPayload }),
      })
      setPartnerLabel("")
      setPartnerPayload("")
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Partner data submission failed")
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {error ? <p className="rounded-xl border border-red-800 bg-red-950 p-3 text-sm text-red-300">{error}</p> : null}
      {isPending ? <p className="text-sm text-gray-500">Refreshing...</p> : null}

      {/* ── Research Ingest ─────────────────────────────── */}
      <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold">Research ingestion</h2>
        <p className="mt-1 text-sm text-gray-400">Search PubMed and persist articles into a research collection.</p>
        <form className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={ingestResearch}>
          <div className="space-y-1">
            <Label htmlFor="col-name">Collection name</Label>
            <Input id="col-name" value={collectionName} onChange={(e) => setCollectionName(e.target.value)} required placeholder="e.g. NAD+ longevity" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pub-query">PubMed query</Label>
            <Input id="pub-query" value={researchQuery} onChange={(e) => setResearchQuery(e.target.value)} required placeholder="e.g. rapamycin aging" />
          </div>
          <Button type="submit" className="self-end bg-teal-600 hover:bg-teal-700">Ingest</Button>
        </form>

        {researchEntries.length > 0 ? (
          <div className="mt-4 space-y-3">
            {researchEntries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-gray-800 p-3">
                <p className="font-medium">{entry.title}</p>
                <p className="mt-1 text-xs text-gray-400">{entry.authors} · {entry.source.toLowerCase()}{entry.externalId ? ` · PMID ${entry.externalId}` : ""}</p>
                {entry.url ? <a href={entry.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-teal-400 hover:underline">View on PubMed</a> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No research entries yet. Run an ingest to populate.</p>
        )}
      </section>

      {/* ── ClinicalTrials.gov Ingest ───────────────────── */}
      <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold">ClinicalTrials.gov ingestion</h2>
        <p className="mt-1 text-sm text-gray-400">Search ClinicalTrials.gov and persist trial records into a collection.</p>
        <form className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={ingestClinicalTrials}>
          <div className="space-y-1">
            <Label htmlFor="ct-col-name">Collection name</Label>
            <Input id="ct-col-name" value={ctCollectionName} onChange={(e) => setCtCollectionName(e.target.value)} required placeholder="e.g. Senolytic trials" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ct-query">Trial search query</Label>
            <Input id="ct-query" value={ctQuery} onChange={(e) => setCtQuery(e.target.value)} required placeholder="e.g. metformin aging" />
          </div>
          <Button type="submit" className="self-end bg-teal-600 hover:bg-teal-700">Ingest</Button>
        </form>
      </section>

      {/* ── Clinician Tasks ──────────────────────────── */}
      <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold">Clinician workflow</h2>
        <p className="mt-1 text-sm text-gray-400">Create and track clinical review tasks.</p>
        <form className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={createTask}>
          <div className="space-y-1">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required placeholder="Review blood panel results" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-desc">Description</Label>
            <Input id="task-desc" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Optional notes" />
          </div>
          <Button type="submit" className="self-end bg-teal-600 hover:bg-teal-700">Create task</Button>
        </form>

        {clinicianTasks.length > 0 ? (
          <div className="mt-4 space-y-3">
            {clinicianTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 p-3">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="mt-1 text-xs text-gray-400">{task.status.toLowerCase()} · priority {task.priority}</p>
                  {task.description ? <p className="mt-1 text-sm text-gray-300">{task.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {task.status !== ClinicianTaskStatus.IN_PROGRESS ? <Button size="sm" variant="outline" className="border-gray-700 text-gray-200" onClick={() => updateTaskStatus(task.id, ClinicianTaskStatus.IN_PROGRESS)}>Start</Button> : null}
                  {task.status !== ClinicianTaskStatus.COMPLETED ? <Button size="sm" variant="outline" className="border-gray-700 text-gray-200" onClick={() => updateTaskStatus(task.id, ClinicianTaskStatus.COMPLETED)}>Complete</Button> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No clinician tasks created yet.</p>
        )}
      </section>

      {/* ── Partner Data ───────────────────────────────── */}
      <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
        <h2 className="text-xl font-semibold">Partner data ingestion</h2>
        <p className="mt-1 text-sm text-gray-400">Submit lab, wearable, or genomics data from external partners.</p>
        <form className="mt-4 grid gap-4 md:grid-cols-[auto_1fr_1fr_auto]" onSubmit={submitPartnerData}>
          <div className="space-y-1">
            <Label htmlFor="partner-source">Source</Label>
            <select id="partner-source" className="flex h-10 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white" value={partnerSource} onChange={(e) => setPartnerSource(e.target.value as PartnerDataSource)}>
              {Object.values(PartnerDataSource).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="partner-label">Label</Label>
            <Input id="partner-label" value={partnerLabel} onChange={(e) => setPartnerLabel(e.target.value)} required placeholder="e.g. Oura ring export" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="partner-payload">Payload (JSON)</Label>
            <Textarea id="partner-payload" value={partnerPayload} onChange={(e) => setPartnerPayload(e.target.value)} required placeholder='{"hrv": 45, "steps": 12000}' rows={1} />
          </div>
          <Button type="submit" className="self-end bg-teal-600 hover:bg-teal-700">Submit</Button>
        </form>

        {partnerRecords.length > 0 ? (
          <div className="mt-4 space-y-3">
            {partnerRecords.map((record) => (
              <div key={record.id} className="rounded-xl border border-gray-800 p-3">
                <p className="font-medium">{record.label}</p>
                <p className="mt-1 text-xs text-gray-400">{record.source.toLowerCase()}{record.partnerId ? ` · ${record.partnerId}` : ""} · {new Date(record.receivedAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No partner data records yet.</p>
        )}
      </section>
    </div>
  )
}
