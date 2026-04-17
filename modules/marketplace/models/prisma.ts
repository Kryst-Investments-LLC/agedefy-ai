import { db } from "@/lib/db"
import type { MarketplaceEntityName } from "@/modules/marketplace/types"

export const marketplacePrismaModelNames = {
  scientists: "marketplaceScientist",
  sponsors: "marketplaceSponsor",
  discoveries: "marketplaceDiscovery",
  fundingRequests: "marketplaceFundingRequest",
  matchScores: "marketplaceMatchScore",
  dealRooms: "marketplaceDealRoom",
  messageThreads: "marketplaceMessageThread",
  transactions: "marketplaceTransaction",
  auditLogs: "marketplaceAuditLog",
  notifications: "marketplaceNotification",
} as const satisfies Record<MarketplaceEntityName, string>

export const marketplacePrismaModels = {
  scientists: db.marketplaceScientist,
  sponsors: db.marketplaceSponsor,
  discoveries: db.marketplaceDiscovery,
  fundingRequests: db.marketplaceFundingRequest,
  matchScores: db.marketplaceMatchScore,
  dealRooms: db.marketplaceDealRoom,
  messageThreads: db.marketplaceMessageThread,
  transactions: db.marketplaceTransaction,
  auditLogs: db.marketplaceAuditLog,
  notifications: db.marketplaceNotification,
} as const
