import { db } from "@/lib/db"
import { toJsonValue } from "@/scientist-sponsor-marketplace/backend/models/json"
import { BaseCrudService } from "@/scientist-sponsor-marketplace/backend/services/baseCrudService"

export const scientistService = new BaseCrudService<Record<string, unknown>, Record<string, unknown>>({
  modelName: "marketplaceScientist",
  defaultOrderBy: { updatedAt: "desc" },
})

export async function ensureScientistProfile(user: { id: string; name?: string | null }) {
  return db.marketplaceScientist.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      displayName: user.name?.trim() || "Principal Investigator",
      institution: "Independent Lab",
      specialty: "Longevity systems biology",
      biography: "Scientific founder profile provisioned automatically for marketplace workflows.",
      categories: toJsonValue(["Longevity", "Computational Biology"]),
      fundingStage: "pre-seed",
    },
    update: {
      displayName: user.name?.trim() || undefined,
    },
  })
}
