import type { UserRole } from "@prisma/client"

import { canPerform } from "@/scientist-sponsor-marketplace/backend/permissions/permissions"
import { ensureScientistProfile } from "@/scientist-sponsor-marketplace/backend/services/scientistService"
import { ensureSponsorProfile } from "@/scientist-sponsor-marketplace/backend/services/sponsorService"
import type { MarketplaceRole, MarketplaceSessionActor } from "@/scientist-sponsor-marketplace/shared/types/entities"
import { getAssumableMarketplaceRoles } from "@/scientist-sponsor-marketplace/shared/utils"

export const identityIntegration = {
  async ensureMarketplaceActors(user: { id: string; name?: string | null }) {
    const [scientist, sponsor] = await Promise.all([ensureScientistProfile(user), ensureSponsorProfile(user)])
    return { scientist, sponsor }
  },

  resolveRole(globalRole: UserRole | string | undefined, requestedRole?: MarketplaceRole): MarketplaceRole {
    const assumableRoles = getAssumableMarketplaceRoles(globalRole)

    if (requestedRole && assumableRoles.includes(requestedRole)) {
      return requestedRole
    }

    if (assumableRoles.includes("admin")) {
      return "admin"
    }

    if (assumableRoles.includes("reviewer")) {
      return "reviewer"
    }

    return "scientist"
  },

  buildActor(params: {
    userId: string
    email: string | null
    name: string | null
    globalRole: string
    requestedRole?: MarketplaceRole
  }): MarketplaceSessionActor {
    return {
      userId: params.userId,
      email: params.email,
      name: params.name,
      globalRole: params.globalRole,
      actingAs: this.resolveRole(params.globalRole, params.requestedRole),
    }
  },

  canActAs(role: MarketplaceRole, permission: Parameters<typeof canPerform>[1]) {
    return canPerform(role, permission)
  },
}
