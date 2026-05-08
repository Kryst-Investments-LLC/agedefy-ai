import { notifyMarketplaceUser } from "@/scientist-sponsor-marketplace/backend/services/notificationService"
import { openOrCreateDealRoom } from "@/scientist-sponsor-marketplace/backend/services/dealRoomService"
import { postDealRoomMessage } from "@/scientist-sponsor-marketplace/backend/services/messageThreadService"
import { listPublishedDiscoveries } from "@/scientist-sponsor-marketplace/backend/services/discoveryService"

export const sponsorWorkflow = {
  async browseDiscoveries(filters: Parameters<typeof listPublishedDiscoveries>[0]) {
    return listPublishedDiscoveries(filters)
  },

  async requestMoreInfo(input: {
    discoveryId: string
    scientistId: string
    sponsorId: string
    sponsorUserId: string
    scientistUserId: string
    message: string
  }) {
    const dealRoom = await openOrCreateDealRoom({
      discoveryId: input.discoveryId,
      scientistId: input.scientistId,
      sponsorId: input.sponsorId,
    })

    await postDealRoomMessage({
      dealRoomId: dealRoom.id,
      senderUserId: input.sponsorUserId,
      senderRole: "sponsor",
      body: input.message,
    })

    await notifyMarketplaceUser({
      recipientUserId: input.scientistUserId,
      recipientRole: "scientist",
      discoveryId: input.discoveryId,
      dealRoomId: dealRoom.id,
      type: "request-more-info",
      title: "A sponsor requested more information",
      body: input.message,
      actionUrl: `/scientist-sponsor-marketplace?dealRoom=${dealRoom.id}`,
      channels: ["in-app"],
      status: "DELIVERED",
    })

    return dealRoom
  },

  async enterDealRoom(input: { discoveryId: string; scientistId: string; sponsorId: string }) {
    return openOrCreateDealRoom(input)
  },
}
