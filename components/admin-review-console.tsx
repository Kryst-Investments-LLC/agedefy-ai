"use client"

import { ReviewSeverity, ReviewStatus } from "@prisma/client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { withIdempotencyHeaders } from "@/lib/client-idempotency"

type ReviewItemRecord = {
  id: string
  title: string
  category: string
  status: ReviewStatus
  severity: ReviewSeverity
  details: string | null
  createdAt: string
}

type AuditLogRecord = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  actorEmail: string | null
  createdAt: string
  details: string | null
}

type AdminReviewConsoleProps = {
  reviewItems: ReviewItemRecord[]
  auditLogs: AuditLogRecord[]
}

type ReviewFormState = {
  title: string
  category: string
  severity: ReviewSeverity
  details: string
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, withIdempotencyHeaders(init, `admin-review-${init?.method?.toLowerCase() || "mutation"}`))
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error ?? "Request failed")
  }

  return body
}

export function AdminReviewConsole({ reviewItems, auditLogs }: AdminReviewConsoleProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ReviewFormState>({
    title: "",
    category: "operations",
    severity: ReviewSeverity.MEDIUM,
    details: "",
  })

  /* ── search / filter state ─────────────────────────── */
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "ALL">("ALL")
  const [auditEntityFilter, setAuditEntityFilter] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  const refresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const filteredReviewItems = reviewItems.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false
    if (searchTerm && !item.title.toLowerCase().includes(searchTerm.toLowerCase()) && !item.category.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditEntityFilter && !log.entityType.toLowerCase().includes(auditEntityFilter.toLowerCase())) return false
    return true
  })

  const exportAuditCsv = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      if (auditEntityFilter) params.set("entityType", auditEntityFilter)
      const response = await fetch(`/api/admin/audit-export?${params.toString()}`)
      if (!response.ok) throw new Error("Export failed")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed")
    } finally {
      setIsExporting(false)
    }
  }

  const createItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    try {
      await requestJson("/api/admin/review-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      setForm({ title: "", category: "operations", severity: ReviewSeverity.MEDIUM, details: "" })
      refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create review item")
    }
  }

  const updateStatus = async (id: string, status: ReviewStatus) => {
    setError(null)

    try {
      await requestJson(`/api/admin/review-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update review item")
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-border bg-background p-6 text-foreground">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Review queue</h2>
            <p className="mt-2 text-sm text-muted-foreground">Track billing, compliance, and operational issues that require human review.</p>
          </div>
          {isPending ? <span className="text-sm text-muted-foreground">Refreshing...</span> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Input placeholder="Search title or category…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-xs" />
          <select className="flex h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReviewStatus | "ALL")}>
            <option value="ALL">All statuses</option>
            {Object.values(ReviewStatus).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <form className="mt-6 space-y-4 rounded-2xl border border-border p-4" onSubmit={createItem}>
          <div className="space-y-2">
            <Label htmlFor="review-title">Title</Label>
            <Input id="review-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="review-category">Category</Label>
              <Input id="review-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-severity">Severity</Label>
              <select id="review-severity" className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as ReviewSeverity }))}>
                {Object.values(ReviewSeverity).map((severity) => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-details">Details</Label>
            <Textarea id="review-details" value={form.details} onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))} />
          </div>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <Button type="submit" className="bg-teal-600 hover:bg-teal-700">Create review item</Button>
        </form>

        <div className="mt-6 space-y-4">
          {filteredReviewItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.category} · {item.severity.toLowerCase()} · {item.status.toLowerCase()}</p>
                  {item.details ? <p className="mt-3 text-sm text-muted-foreground">{item.details}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.status !== ReviewStatus.IN_REVIEW ? <Button variant="outline" className="border-border text-gray-200 hover:bg-gray-800" onClick={() => updateStatus(item.id, ReviewStatus.IN_REVIEW)}>Start</Button> : null}
                  {item.status !== ReviewStatus.RESOLVED ? <Button variant="outline" className="border-border text-gray-200 hover:bg-gray-800" onClick={() => updateStatus(item.id, ReviewStatus.RESOLVED)}>Resolve</Button> : null}
                  {item.status !== ReviewStatus.DISMISSED ? <Button variant="outline" className="border-border text-gray-200 hover:bg-gray-800" onClick={() => updateStatus(item.id, ReviewStatus.DISMISSED)}>Dismiss</Button> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-background p-6 text-foreground">
        <h2 className="text-2xl font-semibold">Audit log</h2>
        <p className="mt-2 text-sm text-muted-foreground">Immutable activity feed for critical operational and billing events.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Input placeholder="Filter by entity type…" value={auditEntityFilter} onChange={(e) => setAuditEntityFilter(e.target.value)} className="max-w-xs" />
          <Button variant="outline" className="border-border text-gray-200 hover:bg-gray-800" onClick={exportAuditCsv} disabled={isExporting}>{isExporting ? "Exporting…" : "Export CSV"}</Button>
        </div>
        <div className="mt-6 space-y-4">
          {filteredAuditLogs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-border p-4">
              <p className="font-medium">{log.action}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{log.entityType}{log.entityId ? ` · ${log.entityId}` : ""}</p>
              <p className="mt-2 text-sm text-muted-foreground">Actor: {log.actorEmail ?? "system"}</p>
              {log.details ? <pre className="mt-3 overflow-x-auto rounded-xl bg-background p-3 text-xs text-muted-foreground">{log.details}</pre> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}