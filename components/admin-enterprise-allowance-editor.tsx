"use client"

import { SubscriptionStatus } from "@prisma/client"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { withJsonMutationHeaders } from "@/lib/client-idempotency"

type EnterpriseSubscriptionRow = {
  id: string
  userName: string | null
  userEmail: string
  plan: string
  status: SubscriptionStatus
  billingCycle: string
  seatQuantity: number
  currentPeriodEnd: string | null
  monthlyAICreditAllowance: number | null
  createdAt: string
  updatedAt: string
}

type FeedbackState = {
  tone: "error" | "success"
  message: string
}

const statusBadgeStyles: Record<SubscriptionStatus, string> = {
  ACTIVE: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-200",
  TRIALING: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  PAST_DUE: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  CANCELED: "border-gray-500/30 bg-gray-500/10 text-muted-foreground",
  INACTIVE: "border-border bg-background text-muted-foreground",
}

function buildDrafts(subscriptions: EnterpriseSubscriptionRow[]) {
  return Object.fromEntries(
    subscriptions.map((subscription) => [subscription.id, subscription.monthlyAICreditAllowance?.toString() ?? ""]),
  )
}

function parseDraftAllowance(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)

  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined
  }

  return parsed
}

function formatAllowance(value: number | null) {
  if (value === null) {
    return "No allowance set"
  }

  return `${value.toLocaleString()} credits`
}

function formatDate(value: string | null) {
  if (!value) {
    return "No renewal date"
  }

  return new Date(value).toLocaleDateString()
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, withJsonMutationHeaders(init, "admin-enterprise-allowance"))
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error ?? "Request failed")
  }

  return body
}

export function AdminEnterpriseAllowanceEditor({ subscriptions }: { subscriptions: EnterpriseSubscriptionRow[] }) {
  const router = useRouter()
  const [records, setRecords] = useState(subscriptions)
  const [drafts, setDrafts] = useState<Record<string, string>>(() => buildDrafts(subscriptions))
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "ALL">("ALL")
  const [feedbackById, setFeedbackById] = useState<Record<string, FeedbackState>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setRecords(subscriptions)
    setDrafts(buildDrafts(subscriptions))
  }, [subscriptions])

  const filteredSubscriptions = records.filter((subscription) => {
    const normalizedSearch = search.trim().toLowerCase()
    const matchesSearch =
      !normalizedSearch ||
      subscription.userEmail.toLowerCase().includes(normalizedSearch) ||
      (subscription.userName?.toLowerCase().includes(normalizedSearch) ?? false)
    const matchesStatus = statusFilter === "ALL" || subscription.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const refresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const updateDraft = (subscriptionId: string, value: string) => {
    setDrafts((current) => ({
      ...current,
      [subscriptionId]: value,
    }))
    setFeedbackById((current) => {
      const next = { ...current }
      delete next[subscriptionId]
      return next
    })
  }

  const saveAllowance = async (subscription: EnterpriseSubscriptionRow) => {
    const parsedAllowance = parseDraftAllowance(drafts[subscription.id] ?? "")

    if (typeof parsedAllowance === "undefined") {
      setFeedbackById((current) => ({
        ...current,
        [subscription.id]: {
          tone: "error",
          message: "Enter a non-negative whole number of credits.",
        },
      }))
      return
    }

    if (parsedAllowance === null) {
      setFeedbackById((current) => ({
        ...current,
        [subscription.id]: {
          tone: "error",
          message: "Allowance is required for enterprise subscriptions.",
        },
      }))
      return
    }

    setSavingId(subscription.id)
    setFeedbackById((current) => {
      const next = { ...current }
      delete next[subscription.id]
      return next
    })

    try {
      const updatedSubscription = await requestJson(`/api/admin/subscriptions/${subscription.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          monthlyAICreditAllowance: parsedAllowance,
        }),
      }) as { monthlyAICreditAllowance: number | null }

      setRecords((current) => current.map((item) => (
        item.id === subscription.id
          ? { ...item, monthlyAICreditAllowance: updatedSubscription.monthlyAICreditAllowance }
          : item
      )))
      setDrafts((current) => ({
        ...current,
        [subscription.id]: updatedSubscription.monthlyAICreditAllowance?.toString() ?? "",
      }))
      setFeedbackById((current) => ({
        ...current,
        [subscription.id]: {
          tone: "success",
          message: "Allowance saved.",
        },
      }))
      refresh()
    } catch (error) {
      setFeedbackById((current) => ({
        ...current,
        [subscription.id]: {
          tone: "error",
          message: error instanceof Error ? error.message : "Unable to update allowance",
        },
      }))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-background p-6 text-foreground">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Enterprise AI allowance editor</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Set the contracted monthly AI credit allowance on enterprise subscriptions without sending operators through the general subscription APIs.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {isPending ? "Refreshing..." : `${filteredSubscriptions.length} enterprise subscription${filteredSubscriptions.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by account name or email..."
          className="max-w-sm border-border bg-background text-foreground placeholder:text-gray-500"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as SubscriptionStatus | "ALL")}
          className="flex h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="ALL">All statuses</option>
          {Object.values(SubscriptionStatus).map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      {filteredSubscriptions.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-background/60 p-6 text-sm text-muted-foreground">
          No enterprise subscriptions matched the current filters.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-background text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Account</th>
                <th className="px-4 py-3 text-left font-medium">Subscription</th>
                <th className="px-4 py-3 text-left font-medium">Current allowance</th>
                <th className="px-4 py-3 text-left font-medium">Monthly allowance</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-background">
              {filteredSubscriptions.map((subscription) => {
                const parsedDraft = parseDraftAllowance(drafts[subscription.id] ?? "")
                const isDraftValid = typeof parsedDraft !== "undefined"
                const hasChanged = parsedDraft !== subscription.monthlyAICreditAllowance
                const feedback = feedbackById[subscription.id]

                return (
                  <tr key={subscription.id} className="align-top hover:bg-gray-800/40">
                    <td className="px-4 py-4">
                      <p className="font-medium text-foreground">{subscription.userName || "Unnamed account"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{subscription.userEmail}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={statusBadgeStyles[subscription.status]}>
                          {subscription.status.toLowerCase()}
                        </Badge>
                        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{subscription.plan}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {subscription.seatQuantity} seat{subscription.seatQuantity === 1 ? "" : "s"} · {subscription.billingCycle} · renews {formatDate(subscription.currentPeriodEnd)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Updated {new Date(subscription.updatedAt).toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-200">
                      <p>{formatAllowance(subscription.monthlyAICreditAllowance)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={drafts[subscription.id] ?? ""}
                        onChange={(event) => updateDraft(subscription.id, event.target.value)}
                        className="max-w-[180px] border-border bg-background text-foreground"
                        aria-label={`Monthly AI allowance for ${subscription.userEmail}`}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">Enter whole credits only.</p>
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        type="button"
                        onClick={() => void saveAllowance(subscription)}
                        disabled={savingId === subscription.id || !isDraftValid || !hasChanged}
                        className="bg-teal-600 text-white hover:bg-teal-700"
                      >
                        {savingId === subscription.id ? "Saving..." : "Save allowance"}
                      </Button>
                      {feedback ? (
                        <p className={`mt-2 text-xs ${feedback.tone === "error" ? "text-red-600 dark:text-red-400" : "text-teal-700 dark:text-teal-300"}`}>
                          {feedback.message}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}