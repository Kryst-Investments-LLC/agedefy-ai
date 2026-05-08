"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

type Props = {
  hasStripeCustomer: boolean
}

export function AccountBillingActions({ hasStripeCustomer }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openPortal = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(body?.error ?? "Unable to open billing portal")
      }

      window.location.href = body.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal request failed")
    } finally {
      setLoading(false)
    }
  }

  if (!hasStripeCustomer) {
    return null
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
      <h2 className="text-lg font-semibold">Billing self-service</h2>
      <p className="mt-2 text-sm text-gray-400">
        Manage payment methods, view invoices, and update or cancel your subscription through the Stripe customer portal.
      </p>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      <Button className="mt-4 bg-teal-600 hover:bg-teal-700" onClick={openPortal} disabled={loading}>
        {loading ? "Opening..." : "Open billing portal"}
      </Button>
    </div>
  )
}
