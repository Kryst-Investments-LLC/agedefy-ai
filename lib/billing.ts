import { BillingRecordCategory, ConsultationType } from "@prisma/client"

import {
  getAICreditPack,
  labOrderPlatformMarginRate,
  resolveAICreditPackPrice,
  telemedicineBaseConsultPriceUsdCents,
  type AICreditPackKey,
  type PricingRegionTierKey,
} from "@/lib/pricing"
import { getAICreditBalanceSnapshot } from "@/lib/ai-credits"

const consultationTypeLabels: Record<ConsultationType, string> = {
  INITIAL: "Initial consultation",
  FOLLOW_UP: "Follow-up consultation",
  LAB_REVIEW: "Lab review consultation",
  PROTOCOL_REVIEW: "Protocol review consultation",
}

export function resolveTelemedicineConsultationBilling(type: ConsultationType) {
  return {
    category: BillingRecordCategory.TELEMEDICINE_CONSULTATION,
    amountCents: telemedicineBaseConsultPriceUsdCents,
    currency: "USD",
    description: `${consultationTypeLabels[type]} request`,
    pricingModel: "telemedicine-base-consult-rate",
    metadata: {
      consultationType: type,
      note: "Base consult billing record captured at the current starting rate.",
    },
  }
}

export function resolveLabOrderBilling(panel: { name: string; priceCents: number }) {
  const platformFeeCents = Math.round(panel.priceCents * labOrderPlatformMarginRate)

  return {
    category: BillingRecordCategory.LAB_ORDER,
    amountCents: panel.priceCents + platformFeeCents,
    currency: "USD",
    description: `${panel.name} lab order`,
    pricingModel: "lab-panel-cost-plus-platform-margin",
    metadata: {
      panelName: panel.name,
      panelPriceCents: panel.priceCents,
      platformFeeCents,
      platformMarginRate: labOrderPlatformMarginRate,
    },
  }
}

export function buildAICreditPackBillingRecord(packKey: AICreditPackKey, regionTier: PricingRegionTierKey) {
  const pack = getAICreditPack(packKey)
  const resolvedPrice = resolveAICreditPackPrice(packKey, regionTier)

  return {
    category: BillingRecordCategory.AI_CREDIT_PACK,
    amountCents: resolvedPrice.amountCents,
    currency: resolvedPrice.currency,
    description: `${pack.name} AI credit purchase`,
    pricingModel: "prepaid-ai-top-up",
    aiCreditPackKey: pack.key,
    aiCreditsDelta: pack.credits,
    regionTier,
    metadata: {
      packName: pack.name,
      credits: pack.credits,
      regionTier,
    },
  }
}

export async function getPurchasedAICreditBalance(userId: string) {
  const snapshot = await getAICreditBalanceSnapshot(userId)

  return snapshot.purchasedCreditsRemaining
}