import { MARKETPLACE_PERMISSIONS, MARKETPLACE_ROLES } from "@/scientist-sponsor-marketplace/shared/constants"
import type { MarketplacePermission, MarketplaceRole } from "@/scientist-sponsor-marketplace/shared/types/entities"

export const marketplacePermissionMatrix: Record<MarketplaceRole, Record<MarketplacePermission, boolean>> = {
  scientist: {
    publishDiscovery: true,
    fundProject: false,
    viewDealRoom: true,
    messageDealRoom: true,
    approveAgreement: false,
    manageScientistProfile: true,
    manageSponsorProfile: false,
    manageFundingRequest: true,
    manageDiscovery: true,
    manageMatchScore: false,
    manageDealRoom: true,
    manageTransaction: false,
    readAuditLog: false,
    manageNotification: true,
  },
  sponsor: {
    publishDiscovery: false,
    fundProject: true,
    viewDealRoom: true,
    messageDealRoom: true,
    approveAgreement: false,
    manageScientistProfile: false,
    manageSponsorProfile: true,
    manageFundingRequest: false,
    manageDiscovery: false,
    manageMatchScore: true,
    manageDealRoom: true,
    manageTransaction: true,
    readAuditLog: false,
    manageNotification: true,
  },
  reviewer: {
    publishDiscovery: false,
    fundProject: false,
    viewDealRoom: true,
    messageDealRoom: true,
    approveAgreement: true,
    manageScientistProfile: false,
    manageSponsorProfile: false,
    manageFundingRequest: false,
    manageDiscovery: false,
    manageMatchScore: true,
    manageDealRoom: true,
    manageTransaction: false,
    readAuditLog: true,
    manageNotification: true,
  },
  admin: Object.fromEntries(MARKETPLACE_PERMISSIONS.map((permission) => [permission, true])) as Record<MarketplacePermission, boolean>,
}

export function canPerform(role: MarketplaceRole, permission: MarketplacePermission) {
  return marketplacePermissionMatrix[role][permission]
}

export function assertMarketplaceRole(value: string): MarketplaceRole {
  if ((MARKETPLACE_ROLES as readonly string[]).includes(value)) {
    return value as MarketplaceRole
  }

  return "scientist"
}
