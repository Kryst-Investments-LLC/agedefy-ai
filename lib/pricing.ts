export type PricingRegionTierKey = "tier1" | "tier2" | "tier3"
export type BillingCycle = "monthly" | "yearly"
export type SelfServePlanKey = "core" | "plus" | "clinic"
export type PricingPlanKey = SelfServePlanKey | "enterprise"
export type AICreditPackKey = "starter" | "growth" | "scale"

type PricingRegionBook = {
  key: PricingRegionTierKey
  name: string
  label: string
  multiplier: number
  currency: "USD"
  markets: string[]
}

type PricingPlanBase = {
  key: PricingPlanKey
  name: string
  audience: string
  description: string
  features: string[]
  premiumAccess: boolean
}

type SelfServePricingPlan = PricingPlanBase & {
  key: SelfServePlanKey
  checkoutEnabled: true
  monthlyUsdCents: number
  yearlyUsdCents: number
  trialDays: number
  aiCreditsPerMonth: number
  minSeats?: number
  featured?: boolean
}

type ContactSalesPricingPlan = PricingPlanBase & {
  key: "enterprise"
  checkoutEnabled: false
  aiCreditsLabel: string
  yearlyFromUsdCents: number
  yearlyToUsdCents: number
}

export type PricingPlanDefinition = SelfServePricingPlan | ContactSalesPricingPlan

type AICreditPack = {
  key: AICreditPackKey
  name: string
  credits: number
  baseUsdCents: number
  description: string
}

type ServicePricingItem = {
  key: "telemedicine" | "lab-testing" | "marketplace"
  title: string
  priceLabel: string
  description: string
}

type RequiredFeatureNotice = {
  title: string
  body: string
}

const selfServePlanKeySet = new Set<SelfServePlanKey>(["core", "plus", "clinic"])
const pricingPlanKeySet = new Set<PricingPlanKey>(["core", "plus", "clinic", "enterprise"])
const aiCreditPackKeySet = new Set<AICreditPackKey>(["starter", "growth", "scale"])
const billingCycleSet = new Set<BillingCycle>(["monthly", "yearly"])
const pricingRegionTierSet = new Set<PricingRegionTierKey>(["tier1", "tier2", "tier3"])
const premiumPlanNames = new Set(["Plus", "Clinic & Research", "Enterprise"])

export const telemedicineBaseConsultPriceUsdCents = 14_900
export const labOrderPlatformMarginRate = 0.15

export const pricingRegionBooks: Record<PricingRegionTierKey, PricingRegionBook> = {
  tier1: {
    key: "tier1",
    name: "Tier 1",
    label: "100% price book",
    multiplier: 1,
    currency: "USD",
    markets: ["US", "Canada", "UK", "Western Europe", "Australia", "Singapore"],
  },
  tier2: {
    key: "tier2",
    name: "Tier 2",
    label: "75% price book",
    multiplier: 0.75,
    currency: "USD",
    markets: ["Eastern Europe", "Latin America", "Gulf", "selected Asia-Pacific markets"],
  },
  tier3: {
    key: "tier3",
    name: "Tier 3",
    label: "60% price book",
    multiplier: 0.6,
    currency: "USD",
    markets: ["India", "Southeast Asia", "Africa"],
  },
}

export const pricingPlans: Record<PricingPlanKey, PricingPlanDefinition> = {
  core: {
    key: "core",
    name: "Core",
    audience: "Consumer",
    description: "The self-serve digital foundation for biomarker tracking, protocol management, and health workflow coordination.",
    checkoutEnabled: true,
    premiumAccess: false,
    monthlyUsdCents: 2400,
    yearlyUsdCents: 22800,
    trialDays: 7,
    aiCreditsPerMonth: 250,
    features: [
      "Biomarker tracking and protocol history",
      "Community, learning, and global search",
      "250 AI credits per month with hard usage caps",
      "Account export, privacy controls, and audit-backed billing",
    ],
  },
  plus: {
    key: "plus",
    name: "Plus",
    audience: "Consumer",
    description: "Premium individual access for AI-heavy workflows, research exploration, and advanced personalization.",
    checkoutEnabled: true,
    premiumAccess: true,
    monthlyUsdCents: 5900,
    yearlyUsdCents: 56400,
    trialDays: 7,
    aiCreditsPerMonth: 1500,
    featured: true,
    features: [
      "Everything in Core",
      "AI Personalization and Clinical Trials Explorer",
      "Lab and telemedicine workflow access",
      "1,500 AI credits per month, then paid top-ups",
    ],
  },
  clinic: {
    key: "clinic",
    name: "Clinic & Research",
    audience: "Professional",
    description: "Seat-based access for clinicians, researchers, and design partners that need operational workflows and team-ready governance.",
    checkoutEnabled: true,
    premiumAccess: true,
    monthlyUsdCents: 14900,
    yearlyUsdCents: 143040,
    trialDays: 7,
    aiCreditsPerMonth: 5000,
    minSeats: 3,
    features: [
      "Everything in Plus",
      "5,000 AI credits per seat each month",
      "Audit-friendly workflows for clinics and research teams",
      "Minimum 3 seats with separate service billing for labs and consults",
    ],
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    audience: "Enterprise",
    description: "Custom annual contracts for organizations that need SSO, SCIM, governance controls, reporting, and contract-managed AI usage.",
    checkoutEnabled: false,
    premiumAccess: true,
    aiCreditsLabel: "Contracted monthly AI allowance with governed top-ups and overage review",
    yearlyFromUsdCents: 1_500_000,
    yearlyToUsdCents: 3_000_000,
    features: [
      "SSO, SCIM, tenant governance, and compliance workflows",
      "Custom reporting, support, and procurement terms",
      "Contracted monthly AI allowance sized to the rollout",
      "Annual contract, implementation planning, and commercial review",
    ],
  },
}

export const aiCreditPacks: Record<AICreditPackKey, AICreditPack> = {
  starter: {
    key: "starter",
    name: "Starter pack",
    credits: 200,
    baseUsdCents: 1500,
    description: "For occasional high-context AI sessions once your monthly allowance is exhausted.",
  },
  growth: {
    key: "growth",
    name: "Growth pack",
    credits: 1000,
    baseUsdCents: 6000,
    description: "For regular AI usage without moving to a higher subscription tier mid-cycle.",
  },
  scale: {
    key: "scale",
    name: "Scale pack",
    credits: 5000,
    baseUsdCents: 24000,
    description: "For research and clinic teams that need extra AI throughput on top of seat-based subscriptions.",
  },
}

export const servicePricing: ServicePricingItem[] = [
  {
    key: "telemedicine",
    title: "Telemedicine consults",
    priceLabel: "From $149 per consult",
    description: "Provider services are billed separately from subscriptions and vary by visit type, jurisdiction, and clinician availability.",
  },
  {
    key: "lab-testing",
    title: "Lab testing",
    priceLabel: "Pass-through panel cost + 15% platform margin",
    description: "Subscriptions unlock the workflow only. Panels and fulfillment are charged when ordered, not bundled into plan pricing.",
  },
  {
    key: "marketplace",
    title: "Marketplace transactions",
    priceLabel: "10% platform take rate",
    description: "Applied to completed marketplace transactions as a separate commerce fee, alongside processor charges where applicable.",
  },
]

export const requiredFeatureNotices: Record<string, RequiredFeatureNotice> = {
  "clinical-trials": {
    title: "Clinical Trials Explorer requires Plus or above",
    body: "Core keeps the digital foundation tight. Upgrade to Plus for premium research workflows and included monthly AI credits.",
  },
  "personalization": {
    title: "AI Personalization requires Plus or above",
    body: "Biozephyra does not offer unlimited AI in base plans. Premium tiers include monthly credits, then transparent paid top-ups.",
  },
  "lab-testing": {
    title: "Lab workflows require Plus or above",
    body: "Workflow access comes from your subscription tier, but panels are billed separately at pass-through cost plus margin.",
  },
}

export function isSelfServePlanKey(value: string): value is SelfServePlanKey {
  return selfServePlanKeySet.has(value as SelfServePlanKey)
}

export function isPricingPlanKey(value: string): value is PricingPlanKey {
  return pricingPlanKeySet.has(value as PricingPlanKey)
}

export function isAICreditPackKey(value: string): value is AICreditPackKey {
  return aiCreditPackKeySet.has(value as AICreditPackKey)
}

export function isBillingCycle(value: string): value is BillingCycle {
  return billingCycleSet.has(value as BillingCycle)
}

export function isPricingRegionTierKey(value: string): value is PricingRegionTierKey {
  return pricingRegionTierSet.has(value as PricingRegionTierKey)
}

export function isPremiumPlanName(planName: string) {
  return premiumPlanNames.has(planName)
}

export function getRequiredFeatureNotice(requiredFeature?: string | null) {
  if (!requiredFeature) {
    return null
  }

  return requiredFeatureNotices[requiredFeature] ?? null
}

export function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function getSelfServePricingPlan(planKey: SelfServePlanKey): SelfServePricingPlan {
  return pricingPlans[planKey] as SelfServePricingPlan
}

export function getEnterprisePricingPlan(): ContactSalesPricingPlan {
  return pricingPlans.enterprise as ContactSalesPricingPlan
}

export function getPricingPlanDefinition(planKeyOrName: string): PricingPlanDefinition | null {
  const normalizedValue = planKeyOrName.trim().toLowerCase()

  if (isPricingPlanKey(normalizedValue)) {
    return pricingPlans[normalizedValue]
  }

  const matchingPlan = Object.values(pricingPlans).find((plan) => plan.name.toLowerCase() === normalizedValue)

  return matchingPlan ?? null
}

export function resolveDefaultMonthlyAICreditAllowance(planKeyOrName: string, seatQuantity = 1) {
  const plan = getPricingPlanDefinition(planKeyOrName)

  if (!plan || !plan.checkoutEnabled) {
    return null
  }

  return plan.aiCreditsPerMonth * Math.max(seatQuantity, 1)
}

export function getAICreditPack(packKey: AICreditPackKey): AICreditPack {
  return aiCreditPacks[packKey]
}

export function resolveSubscriptionPrice(planKey: SelfServePlanKey, regionTier: PricingRegionTierKey, billingCycle: BillingCycle) {
  const plan = getSelfServePricingPlan(planKey)
  const region = pricingRegionBooks[regionTier]
  const baseAmount = billingCycle === "monthly" ? plan.monthlyUsdCents : plan.yearlyUsdCents
  const amountCents = Math.round(baseAmount * region.multiplier)
  const currency = region.currency

  return {
    amountCents,
    currency,
    interval: billingCycle === "monthly" ? "month" : "year",
    billingCycle,
    region,
    priceLabel: formatPrice(amountCents, currency),
    cycleLabel: billingCycle === "monthly" ? "/mo" : "/yr",
  }
}

export function resolveAICreditPackPrice(packKey: AICreditPackKey, regionTier: PricingRegionTierKey) {
  const pack = aiCreditPacks[packKey]
  const region = pricingRegionBooks[regionTier]
  const amountCents = Math.round(pack.baseUsdCents * region.multiplier)

  return {
    amountCents,
    currency: region.currency,
    priceLabel: formatPrice(amountCents, region.currency),
    region,
  }
}

export function formatEnterpriseContractRange() {
  const enterprisePlan = getEnterprisePricingPlan()
  return `${formatPrice(enterprisePlan.yearlyFromUsdCents, "USD")}–${formatPrice(enterprisePlan.yearlyToUsdCents, "USD")}/yr`
}

export function normalizeStripeIntervalToBillingCycle(interval?: string | null): BillingCycle {
  return interval === "year" ? "yearly" : "monthly"
}