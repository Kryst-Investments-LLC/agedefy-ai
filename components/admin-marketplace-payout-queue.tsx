"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import {
  applyAdminMarketplaceQueueFilters,
  readAdminMarketplaceQueueFilters,
  type AdminMarketplaceQueueCategoryFilter,
  type AdminMarketplaceQueueSeverityFilter,
} from "@/lib/admin-marketplace-queue-filters"
import { marketplacePayoutReviewRejectionSchema } from "@/scientist-sponsor-marketplace/shared/schemas/entities"
import type {
  MarketplacePayoutBlockerSeverity,
  MarketplacePayoutRejectionCategory,
  MarketplacePayoutReviewRejection,
} from "@/scientist-sponsor-marketplace/shared/types/entities"

type RejectionDraft = {
  category: MarketplacePayoutRejectionCategory
  blockerSeverity: MarketplacePayoutBlockerSeverity
  rejectionNote: string
  requiredFollowUpAction: string
}

const defaultRejectionDraft: RejectionDraft = {
  category: "evidence_gap",
  blockerSeverity: "medium",
  rejectionNote: "",
  requiredFollowUpAction: "",
}

type QueueItem = {
  id: string
  dealRoomId: string
  discoveryId: string
  discoveryTitle: string
  amountCents: number
  payoutCents: number
  currency: string
  status: string
  createdAt: string
  updatedAt: string
  scientistName: string
  sponsorName: string
  metadata: unknown
}

type Props = {
  items: QueueItem[]
}

type CategoryFilter = AdminMarketplaceQueueCategoryFilter
type SeverityFilter = AdminMarketplaceQueueSeverityFilter

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error ?? "Request failed")
  }

  return body
}

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amountCents / 100)
}

function getPersistedPayoutReview(metadata: unknown): MarketplacePayoutReviewRejection | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  const payoutReview = (metadata as Record<string, unknown>).payoutReview

  if (!payoutReview || typeof payoutReview !== "object" || Array.isArray(payoutReview)) {
    return null
  }

  const parsedReview = marketplacePayoutReviewRejectionSchema.safeParse(payoutReview)

  return parsedReview.success ? parsedReview.data as MarketplacePayoutReviewRejection : null
}

function createRejectionDraft(review: MarketplacePayoutReviewRejection | null | undefined): RejectionDraft {
  if (!review) {
    return { ...defaultRejectionDraft }
  }

  return {
    category: review.category,
    blockerSeverity: review.blockerSeverity,
    rejectionNote: review.rejectionNote,
    requiredFollowUpAction: review.requiredFollowUpAction,
  }
}

function formatRejectionCategory(category: MarketplacePayoutRejectionCategory) {
  switch (category) {
    case "evidence_gap":
      return "Evidence gap"
    case "compliance":
      return "Compliance"
    case "milestone_scope":
      return "Milestone scope"
    case "documentation":
      return "Documentation"
    default:
      return "Other"
  }
}

function formatBlockerSeverity(severity: MarketplacePayoutBlockerSeverity) {
  switch (severity) {
    case "low":
      return "Low blocker"
    case "medium":
      return "Medium blocker"
    case "high":
      return "High blocker"
    default:
      return "Critical blocker"
  }
}

function getCategoryChipClass(category: MarketplacePayoutRejectionCategory) {
  switch (category) {
    case "evidence_gap":
      return "border-sky-400/35 bg-sky-500/12 text-sky-100"
    case "compliance":
      return "border-violet-400/35 bg-violet-500/12 text-violet-100"
    case "milestone_scope":
      return "border-amber-400/35 bg-amber-500/12 text-amber-100"
    case "documentation":
      return "border-emerald-400/35 bg-emerald-500/12 text-emerald-100"
    default:
      return "border-slate-400/35 bg-slate-500/12 text-slate-100"
  }
}

function getSeverityBadgeClass(severity: MarketplacePayoutBlockerSeverity) {
  switch (severity) {
    case "low":
      return "border-emerald-400/35 bg-emerald-500/12 text-emerald-100"
    case "medium":
      return "border-amber-400/35 bg-amber-500/12 text-amber-100"
    case "high":
      return "border-orange-400/35 bg-orange-500/12 text-orange-100"
    default:
      return "border-red-400/35 bg-red-500/12 text-red-100"
  }
}

function describeRejectionCategory(category: MarketplacePayoutRejectionCategory) {
  switch (category) {
    case "evidence_gap":
      return "Use when the milestone evidence is incomplete, weak, or does not substantiate the delivery claim."
    case "compliance":
      return "Use when regulatory, policy, ethics, or approval issues block payout release."
    case "milestone_scope":
      return "Use when the delivered work does not match the milestone scope or acceptance criteria."
    case "documentation":
      return "Use when payout support exists but required documentation, attestations, or artifacts are missing."
    default:
      return "Use for payout blockers that do not fit the standard review buckets."
  }
}

function describeBlockerSeverity(severity: MarketplacePayoutBlockerSeverity) {
  switch (severity) {
    case "low":
      return "Low blocker: minor gap, usually quick to correct without changing the milestone outcome."
    case "medium":
      return "Medium blocker: meaningful issue that needs follow-up evidence before payout can resume."
    case "high":
      return "High blocker: substantial risk or mismatch that likely requires rework or expanded review."
    default:
      return "Critical blocker: payout should remain stopped until a major compliance or delivery issue is resolved."
  }
}

function RejectionCategoryChip({ category }: { category: MarketplacePayoutRejectionCategory }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex cursor-help items-center rounded-full border px-3 py-1 text-xs font-medium ${getCategoryChipClass(category)}`}>
          {formatRejectionCategory(category)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-gray-700 bg-gray-950 text-gray-100">
        {describeRejectionCategory(category)}
      </TooltipContent>
    </Tooltip>
  )
}

function BlockerSeverityBadge({ severity }: { severity: MarketplacePayoutBlockerSeverity }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex cursor-help items-center rounded-full border px-3 py-1 text-xs font-medium ${getSeverityBadgeClass(severity)}`}>
          {formatBlockerSeverity(severity)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-gray-700 bg-gray-950 text-gray-100">
        {describeBlockerSeverity(severity)}
      </TooltipContent>
    </Tooltip>
  )
}

export function AdminMarketplacePayoutQueue({ items }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [busyTransactionId, setBusyTransactionId] = useState<string | null>(null)
  const [rejectionDrafts, setRejectionDrafts] = useState<Record<string, RejectionDraft>>({})
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(() => readAdminMarketplaceQueueFilters(searchParams).categoryFilter)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(() => readAdminMarketplaceQueueFilters(searchParams).severityFilter)

  const refresh = () => startTransition(() => router.refresh())
  const filteredItems = useMemo(
    () => items.filter((item) => {
      const persistedReview = getPersistedPayoutReview(item.metadata)

      const matchesCategory = categoryFilter === "all" || persistedReview?.category === categoryFilter
      const matchesSeverity = severityFilter === "all" || persistedReview?.blockerSeverity === severityFilter

      return matchesCategory && matchesSeverity
    }),
    [categoryFilter, items, severityFilter],
  )

  useEffect(() => {
    const { categoryFilter: nextCategory, severityFilter: nextSeverity } = readAdminMarketplaceQueueFilters(searchParams)

    if (nextCategory !== categoryFilter) {
      setCategoryFilter(nextCategory)
    }

    if (nextSeverity !== severityFilter) {
      setSeverityFilter(nextSeverity)
    }
  }, [categoryFilter, searchParams, severityFilter])

  useEffect(() => {
    const params = applyAdminMarketplaceQueueFilters(new URLSearchParams(searchParams.toString()), {
      categoryFilter,
      severityFilter,
    })

    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()

    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    }
  }, [categoryFilter, pathname, router, searchParams, severityFilter])

  async function handleAction(item: QueueItem, action: "approveAndRelease" | "rejectPayoutReview") {
    setError(null)
    setBusyTransactionId(item.id)

    const rejectionDraft = rejectionDrafts[item.id] ?? defaultRejectionDraft
    const normalizedDraft = {
      ...rejectionDraft,
      rejectionNote: rejectionDraft.rejectionNote.trim(),
      requiredFollowUpAction: rejectionDraft.requiredFollowUpAction.trim(),
    }

    if (action === "rejectPayoutReview" && (!normalizedDraft.rejectionNote || !normalizedDraft.requiredFollowUpAction)) {
      setError("Rejection note and required follow-up action are required before rejecting payout review.")
      setBusyTransactionId(null)
      return
    }

    try {
      await requestJson("/api/scientist-sponsor-marketplace/workflows/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actingAsRole: "admin",
          action,
          dealRoomId: item.dealRoomId,
          transactionId: item.id,
          rejection: action === "rejectPayoutReview" ? normalizedDraft : undefined,
        }),
      })
      if (action === "rejectPayoutReview") {
        setRejectionDrafts((current) => ({ ...current, [item.id]: { ...defaultRejectionDraft } }))
      }
      refresh()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Marketplace payout action failed")
    } finally {
      setBusyTransactionId(null)
    }
  }

  function applyQuickFilter(nextCategory: CategoryFilter, nextSeverity: SeverityFilter) {
    setCategoryFilter(nextCategory)
    setSeverityFilter(nextSeverity)
  }

  async function copyFilteredQueueLink() {
    const params = applyAdminMarketplaceQueueFilters(new URLSearchParams(searchParams.toString()), {
      categoryFilter,
      severityFilter,
    })

    const query = params.toString()
    const shareUrl = `${window.location.origin}${pathname}${query ? `?${query}` : ""}`

    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: "Queue link copied",
        description: "The current filtered admin payout queue URL is on your clipboard.",
      })
    } catch {
      setError("Unable to copy the filtered queue URL to the clipboard.")
      toast({
        title: "Copy failed",
        description: "The filtered admin payout queue URL could not be copied to the clipboard.",
        variant: "destructive",
      })
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <section className="mb-10 rounded-3xl border border-gray-800 bg-gray-950 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Marketplace Payout Review Queue</h2>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Transactions in the settled state are waiting for explicit admin approval before payout capture and sponsor release.
          </p>
        </div>
        <p className="text-sm text-gray-500">{filteredItems.length} of {items.length} pending review</p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="grid flex-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="queue-filter-category" className="text-sm text-gray-300">Filter by latest rejection category</Label>
                <select
                  id="queue-filter-category"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                  className="h-10 rounded-md border border-gray-700 bg-gray-950 px-3 text-sm text-white"
                >
                  <option value="all">All categories</option>
                  <option value="evidence_gap">Evidence gap</option>
                  <option value="compliance">Compliance</option>
                  <option value="milestone_scope">Milestone scope</option>
                  <option value="documentation">Documentation</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="queue-filter-severity" className="text-sm text-gray-300">Filter by latest blocker severity</Label>
                <select
                  id="queue-filter-severity"
                  value={severityFilter}
                  onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
                  className="h-10 rounded-md border border-gray-700 bg-gray-950 px-3 text-sm text-white"
                >
                  <option value="all">All severities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
              <Button
                variant="outline"
                className={`border-gray-700 bg-gray-950 text-gray-200 hover:bg-gray-800 ${categoryFilter === "compliance" ? "border-violet-400/50 bg-violet-500/10 text-violet-100" : ""}`}
                onClick={() => setCategoryFilter((current) => current === "compliance" ? "all" : "compliance")}
              >
                Compliance
              </Button>
              <Button
                variant="outline"
                className={`border-gray-700 bg-gray-950 text-gray-200 hover:bg-gray-800 ${severityFilter === "critical" ? "border-red-400/50 bg-red-500/10 text-red-100" : ""}`}
                onClick={() => setSeverityFilter((current) => current === "critical" ? "all" : "critical")}
              >
                Critical
              </Button>
              <Button
                variant="ghost"
                className="justify-start text-gray-200 hover:bg-gray-800 lg:justify-center"
                onClick={() => applyQuickFilter("all", "all")}
              >
                Clear filters
              </Button>
              <Button
                variant="outline"
                className="border-cyan-400/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                onClick={() => void copyFilteredQueueLink()}
              >
                Copy link
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              className={`border-gray-700 bg-gray-950 text-gray-200 hover:bg-gray-800 ${categoryFilter === "compliance" && severityFilter === "all" ? "border-violet-400/50 bg-violet-500/10 text-violet-100" : ""}`}
              onClick={() => applyQuickFilter("compliance", "all")}
            >
              Quick filter: Compliance
            </Button>
            <Button
              variant="outline"
              className={`border-gray-700 bg-gray-950 text-gray-200 hover:bg-gray-800 ${categoryFilter === "all" && severityFilter === "critical" ? "border-red-400/50 bg-red-500/10 text-red-100" : ""}`}
              onClick={() => applyQuickFilter("all", "critical")}
            >
              Quick filter: Critical
            </Button>
            <Button
              variant="outline"
              className={`border-gray-700 bg-gray-950 text-gray-200 hover:bg-gray-800 ${categoryFilter === "compliance" && severityFilter === "critical" ? "border-rose-400/50 bg-rose-500/10 text-rose-100" : ""}`}
              onClick={() => applyQuickFilter("compliance", "critical")}
            >
              Incident mode
            </Button>
          </div>
          <p className="mt-3 text-xs text-gray-500">Queue filters use the latest persisted payout-review metadata on each transaction and persist in the URL with compact aliases for reproducible review views.</p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Chip Guide</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <RejectionCategoryChip category="evidence_gap" />
            <RejectionCategoryChip category="compliance" />
            <RejectionCategoryChip category="milestone_scope" />
            <RejectionCategoryChip category="documentation" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <BlockerSeverityBadge severity="low" />
            <BlockerSeverityBadge severity="medium" />
            <BlockerSeverityBadge severity="high" />
            <BlockerSeverityBadge severity="critical" />
          </div>
          <p className="mt-3 text-xs text-gray-500">Hover any chip or badge for review guidance.</p>
        </div>
      </div>

      {error ? <p className="mt-4 rounded-xl border border-red-800 bg-red-950 p-3 text-sm text-red-300">{error}</p> : null}
      {isPending ? <p className="mt-4 text-sm text-gray-500">Refreshing...</p> : null}

      {filteredItems.length ? (
        <div className="mt-6 space-y-4">
          {filteredItems.map((item) => {
            const isBusy = busyTransactionId === item.id
            const persistedReview = getPersistedPayoutReview(item.metadata)
            const rejectionDraft = rejectionDrafts[item.id] ?? createRejectionDraft(persistedReview)

            return (
              <div key={item.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-rose-300">{item.status.toLowerCase()} review queue</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{item.discoveryTitle}</h3>
                    <p className="mt-2 text-sm text-gray-400">Scientist: {item.scientistName} · Sponsor: {item.sponsorName}</p>
                    <p className="mt-1 text-sm text-gray-400">Submitted {new Date(item.updatedAt).toLocaleString()} · Deal room {item.dealRoomId}</p>
                    {persistedReview ? (
                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Latest stored rejection</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <RejectionCategoryChip category={persistedReview.category} />
                          <BlockerSeverityBadge severity={persistedReview.blockerSeverity} />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-gray-500">No prior rejection metadata recorded for this payout.</p>
                    )}
                  </div>

                  <div className="min-w-[220px] rounded-2xl border border-gray-800 bg-gray-950 p-4">
                    <p className="text-sm text-gray-400">Authorized amount</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{formatCurrency(item.amountCents, item.currency)}</p>
                    <p className="mt-2 text-sm text-gray-400">Net payout {formatCurrency(item.payoutCents, item.currency)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button className="bg-emerald-500 text-slate-950 hover:bg-emerald-400" disabled={isBusy} onClick={() => void handleAction(item, "approveAndRelease")}>Approve and release</Button>
                  <Button variant="outline" className="border-red-400/40 bg-red-500/10 text-red-100 hover:bg-red-500/20" disabled={isBusy} onClick={() => void handleAction(item, "rejectPayoutReview")}>Reject review</Button>
                  <Link href={`/scientist-sponsor-marketplace?dealRoom=${item.dealRoomId}`}>
                    <Button variant="ghost" className="text-gray-200 hover:bg-gray-800">Open deal room</Button>
                  </Link>
                </div>

                <div className="mt-4 space-y-2 rounded-2xl border border-gray-800 bg-gray-950 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`rejection-category-${item.id}`} className="text-sm text-gray-300">Category</Label>
                      <select
                        id={`rejection-category-${item.id}`}
                        value={rejectionDraft.category}
                        onChange={(event) => setRejectionDrafts((current) => ({
                          ...current,
                          [item.id]: {
                            ...(current[item.id] ?? defaultRejectionDraft),
                            category: event.target.value as MarketplacePayoutRejectionCategory,
                          },
                        }))}
                        className="h-10 rounded-md border border-gray-700 bg-gray-900 px-3 text-sm text-white"
                        disabled={isBusy}
                      >
                        <option value="evidence_gap">Evidence gap</option>
                        <option value="compliance">Compliance</option>
                        <option value="milestone_scope">Milestone scope</option>
                        <option value="documentation">Documentation</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`rejection-severity-${item.id}`} className="text-sm text-gray-300">Blocker severity</Label>
                      <select
                        id={`rejection-severity-${item.id}`}
                        value={rejectionDraft.blockerSeverity}
                        onChange={(event) => setRejectionDrafts((current) => ({
                          ...current,
                          [item.id]: {
                            ...(current[item.id] ?? defaultRejectionDraft),
                            blockerSeverity: event.target.value as MarketplacePayoutBlockerSeverity,
                          },
                        }))}
                        className="h-10 rounded-md border border-gray-700 bg-gray-900 px-3 text-sm text-white"
                        disabled={isBusy}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <Label htmlFor={`rejection-note-${item.id}`} className="text-sm text-gray-300">Rejection summary</Label>
                  <Textarea
                    id={`rejection-note-${item.id}`}
                    value={rejectionDrafts[item.id]?.rejectionNote ?? ""}
                    onChange={(event) => setRejectionDrafts((current) => ({
                      ...current,
                      [item.id]: {
                        ...(current[item.id] ?? defaultRejectionDraft),
                        rejectionNote: event.target.value,
                      },
                    }))}
                    rows={3}
                    placeholder="Summarize why payout review is being rejected."
                    disabled={isBusy}
                  />
                  <Label htmlFor={`follow-up-action-${item.id}`} className="text-sm text-gray-300">Required follow-up action</Label>
                  <Textarea
                    id={`follow-up-action-${item.id}`}
                    value={rejectionDrafts[item.id]?.requiredFollowUpAction ?? ""}
                    onChange={(event) => setRejectionDrafts((current) => ({
                      ...current,
                      [item.id]: {
                        ...(current[item.id] ?? defaultRejectionDraft),
                        requiredFollowUpAction: event.target.value,
                      },
                    }))}
                    rows={3}
                    placeholder="Describe the exact evidence or documentation the scientist must provide before resubmission."
                    disabled={isBusy}
                  />
                  <p className="text-xs text-gray-500">These fields are stored in transaction metadata and rendered separately back to the scientist in the deal room when review is rejected.</p>
                </div>
              </div>
            )
          })}
        </div>
      ) : items.length ? (
        <p className="mt-6 text-sm text-gray-500">No pending payouts match the current rejection category and severity filters.</p>
      ) : (
        <p className="mt-6 text-sm text-gray-500">No marketplace payouts are waiting for admin review.</p>
      )}
      </section>
    </TooltipProvider>
  )
}