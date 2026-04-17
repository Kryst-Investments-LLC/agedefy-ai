import type { MarketplaceEntityName, MarketplacePermission } from "@/scientist-sponsor-marketplace/shared/types/entities"

export const entityLabels: Record<MarketplaceEntityName, string> = {
  scientists: "Scientist",
  sponsors: "Sponsor",
  discoveries: "Discovery",
  fundingRequests: "Funding Request",
  matchScores: "Match Score",
  dealRooms: "Deal Room",
  messageThreads: "Message Thread",
  transactions: "Transaction",
  auditLogs: "Audit Log",
  notifications: "Notification",
}

export const entityWritePermissions: Record<MarketplaceEntityName, MarketplacePermission> = {
  scientists: "manageScientistProfile",
  sponsors: "manageSponsorProfile",
  discoveries: "manageDiscovery",
  fundingRequests: "manageFundingRequest",
  matchScores: "manageMatchScore",
  dealRooms: "manageDealRoom",
  messageThreads: "messageDealRoom",
  transactions: "manageTransaction",
  auditLogs: "readAuditLog",
  notifications: "manageNotification",
}
