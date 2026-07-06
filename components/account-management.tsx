"use client"

import { SubscriptionStatus } from "@prisma/client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getEnterprisePricingPlan, getSelfServePricingPlan, resolveSubscriptionPrice } from "@/lib/pricing"

type SubscriptionRecord = {
  id: string
  plan: string
  status: SubscriptionStatus
  priceCents: number
  currency: string
  billingCycle: string
}

type AccountManagementProps = {
  profile: {
    longevityGoal: string | null
    riskTolerance: string | null
  } | null
  subscriptions: SubscriptionRecord[]
}

type SubscriptionFormState = {
  plan: string
  status: SubscriptionStatus
  priceCents: string
  currency: string
  billingCycle: string
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error ?? "Request failed")
  }

  return body
}

export function AccountManagement({ profile, subscriptions }: AccountManagementProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [profileError, setProfileError] = useState<string | null>(null)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState({
    longevityGoal: profile?.longevityGoal ?? "",
    riskTolerance: profile?.riskTolerance ?? "medium",
  })
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionFormState>({
    plan: getSelfServePricingPlan("plus").name,
    status: SubscriptionStatus.ACTIVE,
    priceCents: String(resolveSubscriptionPrice("plus", "tier1", "monthly").amountCents),
    currency: "USD",
    billingCycle: "monthly",
  })

  const clinicPlan = getSelfServePricingPlan("clinic")
  const enterprisePlan = getEnterprisePricingPlan()
  const manualPlanOptions = [
    { label: getSelfServePricingPlan("core").name, priceCents: resolveSubscriptionPrice("core", "tier1", "monthly").amountCents, billingCycle: "monthly" },
    { label: getSelfServePricingPlan("plus").name, priceCents: resolveSubscriptionPrice("plus", "tier1", "monthly").amountCents, billingCycle: "monthly" },
    { label: clinicPlan.name, priceCents: resolveSubscriptionPrice("clinic", "tier1", "monthly").amountCents * (clinicPlan.minSeats ?? 1), billingCycle: "monthly" },
    { label: enterprisePlan.name, priceCents: enterprisePlan.yearlyFromUsdCents, billingCycle: "yearly" },
  ] as const

  const refresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileError(null)

    try {
      await requestJson("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      })
      refresh()
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to save profile")
    }
  }

  const createSubscription = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubscriptionError(null)

    try {
      await requestJson("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriptionForm),
      })
      refresh()
    } catch (error) {
      setSubscriptionError(error instanceof Error ? error.message : "Unable to create subscription record")
    }
  }

  const updateSubscriptionStatus = async (id: string, status: SubscriptionStatus) => {
    setSubscriptionError(null)

    try {
      await requestJson(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      refresh()
    } catch (error) {
      setSubscriptionError(error instanceof Error ? error.message : "Unable to update subscription")
    }
  }

  const deleteSubscription = async (id: string) => {
    setSubscriptionError(null)

    try {
      await requestJson(`/api/subscriptions/${id}`, { method: "DELETE" })
      refresh()
    } catch (error) {
      setSubscriptionError(error instanceof Error ? error.message : "Unable to delete subscription")
    }
  }

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-border bg-background p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Profile controls</h2>
            <p className="mt-1 text-sm text-muted-foreground">Persist real preference fields to the user profile record.</p>
          </div>
          {isPending ? <span className="text-sm text-muted-foreground">Refreshing...</span> : null}
        </div>

        <form className="mt-6 space-y-4" onSubmit={saveProfile}>
          <div className="space-y-2">
            <Label htmlFor="goal">Longevity goal</Label>
            <Input
              id="goal"
              value={profileForm.longevityGoal}
              onChange={(event) => setProfileForm((current) => ({ ...current, longevityGoal: event.target.value }))}
              placeholder="Improve metabolic resilience"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="risk-tolerance">Risk tolerance</Label>
            <select
              id="risk-tolerance"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={profileForm.riskTolerance}
              onChange={(event) => setProfileForm((current) => ({ ...current, riskTolerance: event.target.value }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          {profileError ? <p className="text-sm text-red-600 dark:text-red-400">{profileError}</p> : null}
          <Button type="submit" className="bg-teal-600 hover:bg-teal-700">Save profile</Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-background p-6">
        <h2 className="text-lg font-semibold">Subscription records</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage subscription state in the database for support workflows, operational testing, and audit verification.</p>

        <form className="mt-6 space-y-4" onSubmit={createSubscription}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <select
                id="plan"
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={subscriptionForm.plan}
                onChange={(event) => {
                  const selected = manualPlanOptions.find((option) => option.label === event.target.value)

                  setSubscriptionForm((current) => ({
                    ...current,
                    plan: event.target.value,
                    priceCents: String(selected?.priceCents ?? current.priceCents),
                    billingCycle: selected?.billingCycle ?? current.billingCycle,
                  }))
                }}
              >
                {manualPlanOptions.map((option) => (
                  <option key={option.label} value={option.label}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price cents</Label>
              <Input
                id="price"
                type="number"
                min="0"
                value={subscriptionForm.priceCents}
                onChange={(event) => setSubscriptionForm((current) => ({ ...current, priceCents: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={subscriptionForm.currency}
                onChange={(event) => setSubscriptionForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle">Billing cycle</Label>
              <select
                id="cycle"
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={subscriptionForm.billingCycle}
                onChange={(event) => setSubscriptionForm((current) => ({ ...current, billingCycle: event.target.value }))}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={subscriptionForm.status}
              onChange={(event) =>
                setSubscriptionForm((current) => ({ ...current, status: event.target.value as SubscriptionStatus }))
              }
            >
              {Object.values(SubscriptionStatus).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          {subscriptionError ? <p className="text-sm text-red-600 dark:text-red-400">{subscriptionError}</p> : null}
          <Button type="submit" className="bg-teal-600 hover:bg-teal-700">Create manual subscription record</Button>
        </form>

        <div className="mt-6 space-y-3">
          {subscriptions.length ? (
            subscriptions.map((subscription) => (
              <div key={subscription.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{subscription.plan}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {subscription.status.toLowerCase()} · {subscription.billingCycle} · {subscription.currency} {subscription.priceCents / 100}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {subscription.status !== SubscriptionStatus.CANCELED ? (
                      <Button
                        variant="outline"
                        className="border-border text-gray-200 hover:bg-gray-800"
                        onClick={() => updateSubscriptionStatus(subscription.id, SubscriptionStatus.CANCELED)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      className="border-border text-gray-200 hover:bg-gray-800"
                      onClick={() => deleteSubscription(subscription.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No subscription records yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}