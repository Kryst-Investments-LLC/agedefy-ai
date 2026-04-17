import type { MarketplaceEntityName } from "@/scientist-sponsor-marketplace/shared/types/entities"

export const marketplaceRouteRegistry: Record<MarketplaceEntityName, string> = {
  scientists: "/api/scientist-sponsor-marketplace/scientists",
  sponsors: "/api/scientist-sponsor-marketplace/sponsors",
  discoveries: "/api/scientist-sponsor-marketplace/discoveries",
  fundingRequests: "/api/scientist-sponsor-marketplace/fundingRequests",
  matchScores: "/api/scientist-sponsor-marketplace/matchScores",
  dealRooms: "/api/scientist-sponsor-marketplace/dealRooms",
  messageThreads: "/api/scientist-sponsor-marketplace/messageThreads",
  transactions: "/api/scientist-sponsor-marketplace/transactions",
  auditLogs: "/api/scientist-sponsor-marketplace/auditLogs",
  notifications: "/api/scientist-sponsor-marketplace/notifications",
}
