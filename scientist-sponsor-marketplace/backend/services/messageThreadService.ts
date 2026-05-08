import { db } from "@/lib/db"
import { toJsonValue } from "@/scientist-sponsor-marketplace/backend/models/json"
import { BaseCrudService } from "@/scientist-sponsor-marketplace/backend/services/baseCrudService"

export const messageThreadService = new BaseCrudService<Record<string, unknown>, Record<string, unknown>>({
  modelName: "marketplaceMessageThread",
  defaultOrderBy: { createdAt: "asc" },
})

export async function postDealRoomMessage(input: {
  dealRoomId: string
  senderUserId?: string | null
  senderRole: string
  body: string
  messageType?: "MESSAGE" | "DOCUMENT" | "AGREEMENT" | "PAYMENT" | "SYSTEM"
  attachments?: Array<{ name: string; url: string; contentType?: string }>
}) {
  const message = await db.marketplaceMessageThread.create({
    data: {
      dealRoomId: input.dealRoomId,
      senderUserId: input.senderUserId ?? null,
      senderRole: input.senderRole,
      body: input.body,
      messageType: input.messageType ?? "MESSAGE",
      attachments: toJsonValue(input.attachments ?? []),
    },
  })

  await db.marketplaceDealRoom.update({
    where: { id: input.dealRoomId },
    data: { lastActivityAt: new Date() },
  })

  return message
}
