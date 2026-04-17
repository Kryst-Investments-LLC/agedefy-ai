import type { MarketplaceEntityName } from "@/modules/marketplace/types"
import { marketplaceRouteRegistry } from "@/scientist-sponsor-marketplace/backend/routes"

export const marketplaceModuleBasePath = "/api/scientist-sponsor-marketplace"

export const marketplaceModuleEndpoints = {
  workspace: `${marketplaceModuleBasePath}/workspace`,
  matches: `${marketplaceModuleBasePath}/matches`,
  workflows: {
    scientist: `${marketplaceModuleBasePath}/workflows/scientist`,
    sponsor: `${marketplaceModuleBasePath}/workflows/sponsor`,
    deal: `${marketplaceModuleBasePath}/workflows/deal`,
  },
} as const

export const marketplaceModuleRouteRegistry: Record<MarketplaceEntityName, string> = marketplaceRouteRegistry
