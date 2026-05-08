import { db } from "@/lib/db"
import { toJsonValue } from "@/scientist-sponsor-marketplace/backend/models/json"
import { BaseCrudService } from "@/scientist-sponsor-marketplace/backend/services/baseCrudService"

export const sponsorService = new BaseCrudService<Record<string, unknown>, Record<string, unknown>>({
  modelName: "marketplaceSponsor",
  defaultOrderBy: { updatedAt: "desc" },
})

export async function ensureSponsorProfile(user: { id: string; name?: string | null }) {
  return db.marketplaceSponsor.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      organizationName: user.name?.trim() ? `${user.name.trim()} Ventures` : "Sponsor Capital",
      organizationType: "venture",
      thesis: "Back translational longevity programs with near-term clinical and platform leverage.",
      preferredCategories: toJsonValue(["Longevity", "Therapeutics", "Diagnostics"]),
      preferredStages: toJsonValue(["preclinical", "translational", "platform"]),
      maxBudgetCents: 500000,
      minImpactScore: 0.55,
      capitalAvailableCents: 2500000,
      dueDiligenceLevel: "standard",
      geographyFocus: toJsonValue(["US", "EU"]),
    },
    update: {},
  })
}
