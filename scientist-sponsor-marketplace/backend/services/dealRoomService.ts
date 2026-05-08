import { db } from "@/lib/db"
import { toJsonValue } from "@/scientist-sponsor-marketplace/backend/models/json"
import { BaseCrudService } from "@/scientist-sponsor-marketplace/backend/services/baseCrudService"

export const dealRoomService = new BaseCrudService<Record<string, unknown>, Record<string, unknown>>({
  modelName: "marketplaceDealRoom",
  defaultOrderBy: { lastActivityAt: "desc" },
})

export async function openOrCreateDealRoom(input: {
  discoveryId: string
  scientistId: string
  sponsorId: string
  agreementTerms?: Record<string, unknown>
}) {
  const existing = await db.marketplaceDealRoom.findFirst({
    where: {
      discoveryId: input.discoveryId,
      sponsorId: input.sponsorId,
    },
  })

  if (existing) {
    return existing
  }

  return db.marketplaceDealRoom.create({
    data: {
      discoveryId: input.discoveryId,
      scientistId: input.scientistId,
      sponsorId: input.sponsorId,
      agreementTerms: toJsonValue(input.agreementTerms ?? {}),
      documentVault: toJsonValue([]),
    },
  })
}
