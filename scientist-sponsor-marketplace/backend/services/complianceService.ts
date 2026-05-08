import { logMarketplaceAuditEvent } from "@/scientist-sponsor-marketplace/backend/services/auditService"
import type { ComplianceAssessment, DealRoom, Discovery, FundingRequest, MarketplaceRole } from "@/scientist-sponsor-marketplace/shared/types/entities"

export const complianceService = {
  evaluateDiscovery(discovery: Discovery, fundingRequest?: FundingRequest | null): ComplianceAssessment {
    const blockers: string[] = []
    const exportControlRisk = discovery.category.toLowerCase().includes("therapeutics") ? "medium" : "low"

    if (!discovery.evidenceLinks.length) {
      blockers.push("Evidence package must include at least one source URL.")
    }

    if ((fundingRequest?.requestedAmountCents ?? discovery.fundingGoalCents) <= 0) {
      blockers.push("Funding needs must be defined before publication.")
    }

    return {
      isCompliant: blockers.length === 0,
      exportControlRisk,
      ipProtectionActions: [
        "Watermark shared diligence files.",
        "Restrict raw datasets to NDA-approved users.",
      ],
      blockers,
    }
  },

  async recordAccess(input: { dealRoomId?: string | null; actorUserId?: string | null; actorRole: MarketplaceRole; entityType: string; entityId?: string | null; ipAddress?: string | null }) {
    return logMarketplaceAuditEvent({
      dealRoomId: input.dealRoomId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole,
      action: "access.recorded",
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      ipAddress: input.ipAddress ?? null,
      details: { accessLogged: true },
    })
  },

  canViewDealRoom(actorRole: MarketplaceRole, dealRoom: DealRoom, scientistId?: string | null, sponsorId?: string | null) {
    if (actorRole === "admin" || actorRole === "reviewer") {
      return true
    }

    if (actorRole === "scientist") {
      return scientistId === dealRoom.scientistId
    }

    if (actorRole === "sponsor") {
      return sponsorId === dealRoom.sponsorId
    }

    return false
  },
}
