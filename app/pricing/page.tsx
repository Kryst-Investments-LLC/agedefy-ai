import { getServerSession } from "next-auth"

import { AppShell } from "@/components/app-shell"
import { PricingCheckout } from "@/components/pricing-checkout"

import { authOptions } from "@/lib/auth"
import { getActiveSubscription } from "@/lib/entitlements"
import { isBillingCycle, isPricingRegionTierKey, type BillingCycle, type PricingRegionTierKey } from "@/lib/pricing"

type PricingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const requiredParam = resolvedSearchParams?.required
  const checkoutParam = resolvedSearchParams?.checkout
  const regionParam = resolvedSearchParams?.region
  const cycleParam = resolvedSearchParams?.cycle

  const requiredFeature = Array.isArray(requiredParam) ? requiredParam[0] : requiredParam ?? null
  const checkoutState = Array.isArray(checkoutParam) ? checkoutParam[0] : checkoutParam ?? null
  const requestedRegion = Array.isArray(regionParam) ? regionParam[0] ?? "" : regionParam ?? ""
  const requestedCycle = Array.isArray(cycleParam) ? cycleParam[0] ?? "" : cycleParam ?? ""
  const initialRegionTier: PricingRegionTierKey = isPricingRegionTierKey(requestedRegion) ? requestedRegion : "tier1"
  const initialBillingCycle: BillingCycle = isBillingCycle(requestedCycle) ? requestedCycle : "monthly"

  const session = await getServerSession(authOptions)
  const activeSubscription = session?.user?.id ? await getActiveSubscription(session.user.id) : null

  return (
    <AppShell pageTitle="Pricing">
      <div className="min-h-full bg-background">
        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="max-w-3xl text-foreground">
            <p className="text-sm uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">Pricing</p>
            <h1 className="mt-3 text-4xl font-bold">Pricing built for self-serve and enterprise</h1>
            <p className="mt-4 text-muted-foreground">
              Biozephyra uses a hybrid pricing model: subscriptions for the core product, hard AI usage caps with paid top-ups,
              separately billed regulated services, and contract pricing for professional and enterprise buyers.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              All prices are shown in USD. Annual plans lock in launch discounts and self-serve tiers start with a 7-day trial.
            </p>
            {checkoutState === "cancelled" ? (
              <p className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
                Checkout was cancelled before payment confirmation. Your selected plan has been preserved so you can retry without reconfiguring your billing cycle.
              </p>
            ) : null}
            {activeSubscription ? (
              <p className="mt-4 text-sm text-teal-700 dark:text-teal-300">Current active entitlement: {activeSubscription.plan} ({activeSubscription.status.toLowerCase()}).</p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No active entitlement is attached to your account yet.</p>
            )}
          </div>
          <PricingCheckout
            currentPlanName={activeSubscription?.plan ?? null}
            requiredFeature={requiredFeature}
            initialRegionTier={initialRegionTier}
            initialBillingCycle={initialBillingCycle}
          />
        </main>
      </div>
    </AppShell>
  )
}
