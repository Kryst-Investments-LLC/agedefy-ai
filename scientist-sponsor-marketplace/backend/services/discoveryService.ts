import { db } from "@/lib/db"
import { toJsonValue } from "@/scientist-sponsor-marketplace/backend/models/json"
import { BaseCrudService } from "@/scientist-sponsor-marketplace/backend/services/baseCrudService"
import { slugify } from "@/scientist-sponsor-marketplace/shared/utils"

export const discoveryService = new BaseCrudService<Record<string, unknown>, Record<string, unknown>>({
  modelName: "marketplaceDiscovery",
  defaultOrderBy: { updatedAt: "desc" },
})

export async function buildDiscoverySlug(title: string) {
  const baseSlug = slugify(title) || "discovery"
  const matches = await db.marketplaceDiscovery.count({
    where: { slug: { startsWith: baseSlug } },
  })

  return matches ? `${baseSlug}-${matches + 1}` : baseSlug
}

export async function listPublishedDiscoveries(filters: {
  category?: string
  maxCostCents?: number
  minImpactScore?: number
  stage?: string
  search?: string
} = {}) {
  const records = await db.marketplaceDiscovery.findMany({
    where: {
      status: "PUBLISHED",
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.stage ? { developmentStage: filters.stage } : {}),
      ...(typeof filters.minImpactScore === "number" ? { scientificImpactScore: { gte: filters.minImpactScore } } : {}),
      ...(typeof filters.maxCostCents === "number" ? { fundingGoalCents: { lte: filters.maxCostCents } } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search } },
              { summary: { contains: filters.search } },
              { evidenceSummary: { contains: filters.search } },
            ],
          }
        : {}),
    },
    orderBy: [{ scientificImpactScore: "desc" }, { updatedAt: "desc" }],
  })

  return JSON.parse(JSON.stringify(records))
}

export async function appendDiscoveryEvidence(discoveryId: string, evidence: { label: string; url: string; evidenceType?: string }) {
  const discovery = await db.marketplaceDiscovery.findUnique({ where: { id: discoveryId } })
  const currentLinks = Array.isArray(discovery?.evidenceLinks) ? discovery.evidenceLinks : []

  return db.marketplaceDiscovery.update({
    where: { id: discoveryId },
    data: {
      evidenceLinks: toJsonValue([...currentLinks, evidence]),
      updatedAt: new Date(),
    },
  })
}
