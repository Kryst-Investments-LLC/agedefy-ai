"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  aiCreditPacks,
  formatEnterpriseContractRange,
  getEnterprisePricingPlan,
  getRequiredFeatureNotice,
  getSelfServePricingPlan,
  pricingRegionBooks,
  resolveAICreditPackPrice,
  resolveSubscriptionPrice,
  servicePricing,
  type BillingCycle,
  type PricingPlanKey,
  type PricingRegionTierKey,
} from "@/lib/pricing"

type PricingCheckoutProps = {
  currentPlanName?: string | null
  requiredFeature?: string | null
  initialRegionTier: PricingRegionTierKey
  initialBillingCycle: BillingCycle
}

const orderedPlanKeys: PricingPlanKey[] = ["core", "plus", "clinic", "enterprise"]
const orderedRegionKeys: PricingRegionTierKey[] = ["tier1", "tier2", "tier3"]
const orderedPackKeys = ["starter", "growth", "scale"] as const

export function PricingCheckout({
  currentPlanName,
  requiredFeature,
  initialRegionTier,
  initialBillingCycle,
}: PricingCheckoutProps) {
  const [activeCheckout, setActiveCheckout] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [regionTier, setRegionTier] = useState<PricingRegionTierKey>(initialRegionTier)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle)

  const selectedRegion = pricingRegionBooks[regionTier]
  const requiredFeatureNotice = getRequiredFeatureNotice(requiredFeature)

  const startSubscriptionCheckout = async (planKey: "core" | "plus" | "clinic") => {
    setActiveCheckout(`plan:${planKey}`)
    setError(null)

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, regionTier, billingCycle }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Unable to create checkout session")
      }

      window.location.href = payload.url
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start checkout")
      setActiveCheckout(null)
    }
  }

  const startAICreditPackCheckout = async (packKey: (typeof orderedPackKeys)[number]) => {
    setActiveCheckout(`pack:${packKey}`)
    setError(null)

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiCreditPackKey: packKey, regionTier }),
      })

      const payload = await response.json()

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Unable to create checkout session")
      }

      window.location.href = payload.url
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start checkout")
      setActiveCheckout(null)
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {requiredFeatureNotice ? (
        <section className="rounded-3xl border border-teal-500/25 bg-teal-500/10 p-5 text-white">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-300">Access requirement</p>
          <h2 className="mt-3 text-2xl font-semibold">{requiredFeatureNotice.title}</h2>
          <p className="mt-3 max-w-3xl text-sm text-teal-50/90">{requiredFeatureNotice.body}</p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-gray-800 bg-gray-950 p-6 text-white">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-teal-400">Fixed regional price books</p>
            <h2 className="mt-3 text-2xl font-semibold">Choose market tier and billing cycle</h2>
            <p className="mt-3 text-sm text-gray-400">
              Pricing is anchored in USD and published as fixed regional catalogs. Biozephyra does not rely on live exchange-rate conversion at checkout.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-200" htmlFor="pricing-region-tier">Market tier</label>
            <select
              id="pricing-region-tier"
              className="flex h-10 w-full rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white"
              value={regionTier}
              onChange={(event) => setRegionTier(event.target.value as PricingRegionTierKey)}
            >
              {orderedRegionKeys.map((key) => {
                const region = pricingRegionBooks[key]
                return (
                  <option key={key} value={key}>
                    {region.name} · {region.label}
                  </option>
                )
              })}
            </select>
            <p className="text-xs text-gray-400">{selectedRegion.markets.join(", ")}</p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-200">Billing cycle</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={billingCycle === "monthly" ? "default" : "outline"}
                className={billingCycle === "monthly" ? "bg-teal-600 hover:bg-teal-700" : "border-gray-700 text-gray-200 hover:bg-gray-800"}
                onClick={() => setBillingCycle("monthly")}
              >
                Monthly
              </Button>
              <Button
                type="button"
                variant={billingCycle === "yearly" ? "default" : "outline"}
                className={billingCycle === "yearly" ? "bg-teal-600 hover:bg-teal-700" : "border-gray-700 text-gray-200 hover:bg-gray-800"}
                onClick={() => setBillingCycle("yearly")}
              >
                Annual
              </Button>
            </div>
            <p className="text-xs text-gray-400">Annual pricing uses the launch discount instead of burying value inside an opaque enterprise-only quote.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-4">
        {orderedPlanKeys.map((planKey) => {
          if (planKey === "enterprise") {
            const plan = getEnterprisePricingPlan()
            const isCurrentPlan = currentPlanName === plan.name

            return (
              <section key={plan.key} className="rounded-3xl border border-gray-800 bg-gray-950 p-6 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-teal-400">{plan.audience}</p>
                    <h2 className="mt-3 text-2xl font-semibold">{plan.name}</h2>
                  </div>
                  {isCurrentPlan ? (
                    <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-200">
                      Current plan
                    </span>
                  ) : null}
                </div>

                <div className="mt-6">
                  <p className="text-4xl font-bold">Custom</p>
                  <p className="mt-2 text-sm text-gray-400">{formatEnterpriseContractRange()}</p>
                  <p className="mt-2 text-sm text-teal-200">{plan.aiCreditsLabel}</p>
                </div>

                <p className="mt-4 text-sm text-gray-400">{plan.description}</p>

                <ul className="mt-6 space-y-3 text-sm text-gray-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild className="mt-8 w-full bg-white text-gray-950 hover:bg-gray-200">
                  <a href="/contact">Talk to sales</a>
                </Button>
              </section>
            )
          }

          const plan = getSelfServePricingPlan(planKey)
          const resolvedPrice = resolveSubscriptionPrice(plan.key, regionTier, billingCycle)
          const isCurrentPlan = currentPlanName === plan.name

          return (
            <section
              key={plan.key}
              className={`rounded-3xl border p-6 text-white ${plan.featured ? "border-teal-500/40 bg-teal-500/10" : "border-gray-800 bg-gray-950"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-teal-400">{plan.audience}</p>
                  <h2 className="mt-3 text-2xl font-semibold">{plan.name}</h2>
                </div>
                {isCurrentPlan ? (
                  <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-200">
                    Current plan
                  </span>
                ) : null}
              </div>

              <div className="mt-6">
                <p className="text-4xl font-bold">
                  {resolvedPrice.priceLabel}
                  <span className="ml-1 text-lg font-medium text-gray-400">{resolvedPrice.cycleLabel}</span>
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  {plan.trialDays}-day trial{plan.minSeats ? ` · minimum ${plan.minSeats} seats` : ""}
                </p>
                <p className="mt-2 text-sm text-teal-200">
                  {plan.aiCreditsPerMonth.toLocaleString()} AI credits per month{plan.minSeats ? " per seat" : ""}
                </p>
              </div>

              <p className="mt-4 text-sm text-gray-400">{plan.description}</p>

              <ul className="mt-6 space-y-3 text-sm text-gray-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-8 w-full bg-teal-600 hover:bg-teal-700"
                onClick={() => startSubscriptionCheckout(plan.key)}
                disabled={activeCheckout === `plan:${plan.key}`}
              >
                {activeCheckout === `plan:${plan.key}` ? "Starting checkout..." : `Start ${plan.trialDays}-day trial`}
              </Button>
            </section>
          )
        })}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <section className="rounded-3xl border border-gray-800 bg-gray-950 p-6 text-white">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">AI usage caps</p>
          <h2 className="mt-3 text-2xl font-semibold">Paid top-ups instead of unlimited AI</h2>
          <p className="mt-3 text-sm text-gray-400">
            Every subscription includes a monthly AI allowance. When usage spikes, Biozephyra sells fixed add-on packs instead of pretending AI is unlimited and hiding the margin inside every tier.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {orderedPackKeys.map((packKey) => {
            const pack = aiCreditPacks[packKey]
            const resolvedPack = resolveAICreditPackPrice(pack.key, regionTier)

            return (
              <div key={pack.key} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-teal-400">{pack.name}</p>
                <h3 className="mt-3 text-2xl font-semibold">{pack.credits.toLocaleString()} credits</h3>
                <p className="mt-2 text-lg font-medium text-white">{resolvedPack.priceLabel}</p>
                <p className="mt-3 text-sm text-gray-400">{pack.description}</p>
                <Button
                  className="mt-5 w-full bg-white text-gray-950 hover:bg-gray-200"
                  onClick={() => startAICreditPackCheckout(pack.key)}
                  disabled={activeCheckout === `pack:${pack.key}`}
                >
                  {activeCheckout === `pack:${pack.key}` ? "Starting checkout..." : "Buy credit pack"}
                </Button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-950 p-6 text-white">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">Separate service pricing</p>
          <h2 className="mt-3 text-2xl font-semibold">Regulated and transactional services are billed separately</h2>
          <p className="mt-3 text-sm text-gray-400">
            Consults, panels, and commerce fees sit outside the subscription so the platform can operate globally without cross-subsidizing regulated services inside a flat SaaS price.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {servicePricing.map((service) => (
            <div key={service.key} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-teal-400">{service.title}</p>
              <h3 className="mt-3 text-xl font-semibold">{service.priceLabel}</h3>
              <p className="mt-3 text-sm text-gray-400">{service.description}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Current region book: {selectedRegion.name} ({selectedRegion.label}) · published in {selectedRegion.currency} with no live FX conversion at checkout.
        </p>
      </section>
    </div>
  )
}