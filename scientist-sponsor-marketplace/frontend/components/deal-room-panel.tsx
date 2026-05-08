"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMarketplaceEntity } from "@/scientist-sponsor-marketplace/frontend/hooks/use-marketplace-entity"
import { useMarketplaceWorkspace } from "@/scientist-sponsor-marketplace/frontend/hooks/use-marketplace-workspace"
import { marketplacePayoutReviewRejectionSchema } from "@/scientist-sponsor-marketplace/shared/schemas/entities"
import { formatCurrency } from "@/scientist-sponsor-marketplace/shared/utils"

function getRejectedPayoutReview(metadata: Record<string, unknown>) {
  const payoutReview = metadata.payoutReview

  if (!payoutReview || typeof payoutReview !== "object" || Array.isArray(payoutReview)) {
    return null
  }

  const parsedReview = marketplacePayoutReviewRejectionSchema.safeParse(payoutReview)
  if (!parsedReview.success) {
    return null
  }

  return parsedReview.data
}

function formatRejectionCategory(category: string) {
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

function formatBlockerSeverity(severity: string) {
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

function getCategoryChipClass(category: string) {
  switch (category) {
    case "evidence_gap":
      return "border-sky-300/35 bg-sky-400/15 text-sky-100"
    case "compliance":
      return "border-fuchsia-300/35 bg-fuchsia-400/15 text-fuchsia-100"
    case "milestone_scope":
      return "border-amber-300/35 bg-amber-400/15 text-amber-100"
    case "documentation":
      return "border-emerald-300/35 bg-emerald-400/15 text-emerald-100"
    default:
      return "border-slate-300/35 bg-slate-400/15 text-slate-100"
  }
}

function getSeverityBadgeClass(severity: string) {
  switch (severity) {
    case "low":
      return "border-emerald-300/35 bg-emerald-400/15 text-emerald-100"
    case "medium":
      return "border-amber-300/35 bg-amber-400/15 text-amber-100"
    case "high":
      return "border-orange-300/35 bg-orange-400/15 text-orange-100"
    default:
      return "border-red-300/35 bg-red-400/15 text-red-100"
  }
}

function describeRejectionCategory(category: string) {
  switch (category) {
    case "evidence_gap":
      return "Evidence incomplete or not strong enough to justify milestone release."
    case "compliance":
      return "Compliance, policy, or regulatory blockers are preventing payout release."
    case "milestone_scope":
      return "Delivered work does not yet satisfy the milestone scope or acceptance criteria."
    case "documentation":
      return "Supporting documentation or required attestations are still missing."
    default:
      return "A payout blocker exists outside the standard review categories."
  }
}

function describeBlockerSeverity(severity: string) {
  switch (severity) {
    case "low":
      return "Low blocker: small fix or evidence update likely resolves the review quickly."
    case "medium":
      return "Medium blocker: material follow-up is required before payout can continue."
    case "high":
      return "High blocker: substantial risk or scope mismatch needs rework or deeper review."
    default:
      return "Critical blocker: payout remains stopped until a major issue is resolved."
  }
}

function RejectionCategoryChip({ category }: { category: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex cursor-help items-center rounded-full border px-3 py-1 text-[11px] font-medium ${getCategoryChipClass(category)}`}>
          {formatRejectionCategory(category)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-red-400/30 bg-slate-950 text-red-50">
        {describeRejectionCategory(category)}
      </TooltipContent>
    </Tooltip>
  )
}

function BlockerSeverityBadge({ severity }: { severity: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex cursor-help items-center rounded-full border px-3 py-1 text-[11px] font-medium ${getSeverityBadgeClass(severity)}`}>
          {formatBlockerSeverity(severity)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-red-400/30 bg-slate-950 text-red-50">
        {describeBlockerSeverity(severity)}
      </TooltipContent>
    </Tooltip>
  )
}

export function DealRoomPanel() {
  const { snapshot, actingAs, refresh } = useMarketplaceWorkspace()
  const { runWorkflow, submitting } = useMarketplaceEntity(actingAs)
  const searchParams = useSearchParams()
  const [selectedDealRoomId, setSelectedDealRoomId] = useState(snapshot.dealRooms[0]?.id ?? "")
  const [messageBody, setMessageBody] = useState("Shared diligence package uploaded. Please review the agreement draft.")
  const [agreementTerms, setAgreementTerms] = useState('{\n  "structure": "convertible grant",\n  "boardObserver": true,\n  "dataAccess": "staged"\n}')
  const [paymentAmount, setPaymentAmount] = useState("150000")
  const [subscriptionTier, setSubscriptionTier] = useState("growth")
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null)
  const handledSessionIdsRef = useRef<Set<string>>(new Set())

  const activeDealRoom = useMemo(
    () => snapshot.dealRooms.find((dealRoom) => dealRoom.id === selectedDealRoomId) ?? snapshot.dealRooms[0] ?? null,
    [selectedDealRoomId, snapshot.dealRooms],
  )

  const messages = snapshot.messages.filter((message) => message.dealRoomId === activeDealRoom?.id)
  const transactions = snapshot.transactions.filter((transaction) => transaction.dealRoomId === activeDealRoom?.id)
  const milestoneReadyTransaction = transactions.find((transaction) => transaction.status === "AUTHORIZED") ?? null
  const reviewReadyTransaction = transactions.find((transaction) => transaction.status === "SETTLED") ?? null
  const canMarkMilestoneComplete = Boolean(activeDealRoom && milestoneReadyTransaction && actingAs === "scientist")
  const canApproveAndRelease = Boolean(activeDealRoom && reviewReadyTransaction && actingAs === "admin")

  useEffect(() => {
    const returnedDealRoomId = searchParams.get("dealRoom")

    if (returnedDealRoomId && snapshot.dealRooms.some((dealRoom) => dealRoom.id === returnedDealRoomId)) {
      setSelectedDealRoomId(returnedDealRoomId)
    }
  }, [searchParams, snapshot.dealRooms])

  useEffect(() => {
    const checkoutState = searchParams.get("checkout")

    if (!checkoutState) {
      return
    }

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete("checkout")
    nextUrl.searchParams.delete("session_id")

    if (checkoutState === "cancelled") {
      setPaymentStatusMessage("Stripe checkout was cancelled before funding authorization completed.")
      window.history.replaceState({}, "", nextUrl.toString())
      return
    }

    if (checkoutState !== "success") {
      return
    }

    const sessionId = searchParams.get("session_id")
    if (!sessionId) {
      setPaymentStatusMessage("Stripe checkout returned without a session identifier.")
      window.history.replaceState({}, "", nextUrl.toString())
      return
    }

    if (handledSessionIdsRef.current.has(sessionId)) {
      return
    }

    handledSessionIdsRef.current.add(sessionId)
    setPaymentStatusMessage("Confirming Stripe funding authorization...")

    void (async () => {
      try {
        const response = await fetch("/api/scientist-sponsor-marketplace/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to confirm Stripe checkout")
        }

        if (typeof payload?.dealRoomId === "string") {
          setSelectedDealRoomId(payload.dealRoomId)
        }

        setPaymentStatusMessage("Funding authorization confirmed.")
        await refresh()
      } catch (error) {
        setPaymentStatusMessage(error instanceof Error ? error.message : "Unable to confirm Stripe checkout")
      } finally {
        window.history.replaceState({}, "", nextUrl.toString())
      }
    })()
  }, [refresh, searchParams])

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeDealRoom) {
      return
    }

    await runWorkflow("deal", { action: "message", dealRoomId: activeDealRoom.id, body: messageBody })
    setMessageBody("")
    await refresh()
  }

  async function buildAgreement() {
    if (!activeDealRoom) {
      return
    }

    await runWorkflow("deal", {
      action: "buildAgreement",
      dealRoomId: activeDealRoom.id,
      agreementTerms: JSON.parse(agreementTerms),
    })
    await refresh()
  }

  async function approveAgreement() {
    if (!activeDealRoom) {
      return
    }

    await runWorkflow("deal", { action: "approveAgreement", dealRoomId: activeDealRoom.id, approvalNote: "Architectural and diligence review cleared." })
    await refresh()
  }

  async function fundProject() {
    if (!activeDealRoom) {
      return
    }

    const result = await runWorkflow("sponsor", {
      action: "fund",
      dealRoomId: activeDealRoom.id,
      amountCents: Number(paymentAmount),
      subscriptionTier,
      currency: "USD",
    })

    const checkoutUrl = typeof result?.checkoutUrl === "string"
      ? result.checkoutUrl
      : typeof result?.metadata?.checkoutUrl === "string"
        ? result.metadata.checkoutUrl
        : null

    if (checkoutUrl) {
      window.location.assign(checkoutUrl)
      return
    }

    await refresh()
  }

  async function markMilestoneComplete() {
    if (!activeDealRoom || !milestoneReadyTransaction || !canMarkMilestoneComplete) {
      return
    }

    setPaymentStatusMessage("Submitting milestone completion for admin review...")

    try {
      await runWorkflow("deal", {
        action: "markMilestoneComplete",
        dealRoomId: activeDealRoom.id,
        transactionId: milestoneReadyTransaction.id,
      })
      setPaymentStatusMessage("Milestone marked complete. Pending admin payout review.")
      await refresh()
    } catch (error) {
      setPaymentStatusMessage(error instanceof Error ? error.message : "Unable to mark milestone complete")
    }
  }

  async function approveAndRelease() {
    if (!activeDealRoom || !reviewReadyTransaction || !canApproveAndRelease) {
      return
    }

    setPaymentStatusMessage("Admin payout approval in progress...")

    try {
      await runWorkflow("deal", {
        action: "approveAndRelease",
        dealRoomId: activeDealRoom.id,
        transactionId: reviewReadyTransaction.id,
      })
      setPaymentStatusMessage("Admin approved milestone review and released payout.")
      await refresh()
    } catch (error) {
      setPaymentStatusMessage(error instanceof Error ? error.message : "Unable to approve and release payout")
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Card className="border-white/10 bg-slate-950/80 text-white">
        <CardHeader>
          <CardTitle>Active Deal Rooms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.dealRooms.length ? snapshot.dealRooms.map((dealRoom) => (
            <button
              key={dealRoom.id}
              type="button"
              className={`w-full rounded-2xl border p-4 text-left transition ${dealRoom.id === activeDealRoom?.id ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              onClick={() => setSelectedDealRoomId(dealRoom.id)}
            >
              <p className="font-medium text-white">{dealRoom.status.toLowerCase()} · {dealRoom.agreementStatus.toLowerCase()}</p>
              <p className="mt-1 text-sm text-white/55">Updated {new Date(dealRoom.updatedAt).toLocaleString()}</p>
            </button>
          )) : <p className="text-sm text-white/55">No deal rooms have been opened yet.</p>}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Messaging</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
              {messages.length ? messages.map((message) => (
                <div key={message.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-white">{message.senderRole}</p>
                    <p className="text-xs text-white/45">{new Date(message.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="mt-2 text-sm text-white/70">{message.body}</p>
                </div>
              )) : <p className="text-sm text-white/55">Messages appear here once diligence starts.</p>}
            </div>
            <form className="mt-4 space-y-3" onSubmit={sendMessage}>
              <Textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} rows={4} placeholder="Write an update, diligence request, or agreement note." />
              <Button type="submit" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" disabled={submitting || !activeDealRoom}>Send message</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Agreement Builder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={agreementTerms} onChange={(event) => setAgreementTerms(event.target.value)} rows={8} />
            <div className="flex flex-wrap gap-3">
              <Button className="bg-white text-slate-950 hover:bg-white/90" onClick={() => void buildAgreement()} disabled={submitting || !activeDealRoom}>Build agreement</Button>
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => void approveAgreement()} disabled={submitting || !activeDealRoom}>Approve agreement</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80 text-white">
          <CardHeader>
            <CardTitle>Payment Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentStatusMessage ? (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {paymentStatusMessage}
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount (cents)</Label>
                <Input type="number" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Subscription tier</Label>
                <select className="h-10 rounded-md border border-white/10 bg-slate-900 px-3 text-sm" value={subscriptionTier} onChange={(event) => setSubscriptionTier(event.target.value)}>
                  <option value="scout">Scout</option>
                  <option value="growth">Growth</option>
                  <option value="strategic">Strategic</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={() => void fundProject()} disabled={submitting || !activeDealRoom}>Authorize funding</Button>
              {canMarkMilestoneComplete ? (
                <Button variant="outline" className="border-amber-300/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20" onClick={() => void markMilestoneComplete()} disabled={submitting}>
                  Mark milestone complete
                </Button>
              ) : null}
              {canApproveAndRelease ? (
                <Button variant="outline" className="border-rose-300/40 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20" onClick={() => void approveAndRelease()} disabled={submitting}>
                  Admin approve and release
                </Button>
              ) : null}
            </div>
            <div className="space-y-3">
              {transactions.length ? transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                  <p className="font-medium text-white">{transaction.status.toLowerCase()} · {formatCurrency(transaction.amountCents)}</p>
                  <p className="mt-1">Payout {formatCurrency(transaction.payoutCents)} after platform and transaction fees.</p>
                  {transaction.status === "AUTHORIZED" ? <p className="mt-2 text-xs text-amber-200/80">Scientist milestone completion required before admin payout review.</p> : null}
                  {transaction.status === "SETTLED" ? <p className="mt-2 text-xs text-rose-200/80">Pending admin payout approval and release.</p> : null}
                  {(() => {
                    const rejectedReview = getRejectedPayoutReview(transaction.metadata)

                    if (!rejectedReview?.rejectionNote) {
                      return null
                    }

                    return (
                      <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-100">
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                          <p className="font-medium uppercase tracking-[0.18em] text-red-200">Latest Admin Rejection</p>
                          <p className="text-[11px] text-red-200/70">Hover the review chips for category and severity guidance.</p>
                        </div>
                        {rejectedReview.reviewedAt ? <p className="mt-1 text-red-200/80">Reviewed {new Date(rejectedReview.reviewedAt).toLocaleString()}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <RejectionCategoryChip category={rejectedReview.category} />
                          <BlockerSeverityBadge severity={rejectedReview.blockerSeverity} />
                        </div>
                        <div className="mt-3">
                          <p className="text-red-200/70">Summary</p>
                          <p className="mt-1 leading-5">{rejectedReview.rejectionNote}</p>
                        </div>
                        <div className="mt-3">
                          <p className="text-red-200/70">Required follow-up action</p>
                          <p className="mt-1 leading-5">{rejectedReview.requiredFollowUpAction}</p>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )) : <p className="text-sm text-white/55">No payments processed yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </TooltipProvider>
  )
}
