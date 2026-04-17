import { auditService } from "@/scientist-sponsor-marketplace/backend/services/auditService"
import { dealRoomService } from "@/scientist-sponsor-marketplace/backend/services/dealRoomService"
import { discoveryService } from "@/scientist-sponsor-marketplace/backend/services/discoveryService"
import { fundingRequestService } from "@/scientist-sponsor-marketplace/backend/services/fundingRequestService"
import { matchScoreService } from "@/scientist-sponsor-marketplace/backend/services/matchScoreService"
import { messageThreadService } from "@/scientist-sponsor-marketplace/backend/services/messageThreadService"
import { notificationService } from "@/scientist-sponsor-marketplace/backend/services/notificationService"
import { scientistService } from "@/scientist-sponsor-marketplace/backend/services/scientistService"
import { sponsorService } from "@/scientist-sponsor-marketplace/backend/services/sponsorService"
import { transactionService } from "@/scientist-sponsor-marketplace/backend/services/transactionService"

export const marketplaceServices = {
  scientists: scientistService,
  sponsors: sponsorService,
  discoveries: discoveryService,
  fundingRequests: fundingRequestService,
  matchScores: matchScoreService,
  dealRooms: dealRoomService,
  messageThreads: messageThreadService,
  transactions: transactionService,
  auditLogs: auditService,
  notifications: notificationService,
} as const
