import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { identityIntegration } from "@/scientist-sponsor-marketplace/backend/integrations/identityIntegration"
import { complianceService } from "@/scientist-sponsor-marketplace/backend/services/complianceService"
import type { MarketplaceEntityName, MarketplaceRole } from "@/scientist-sponsor-marketplace/shared/types/entities"

export interface MarketplaceActorContext {
  userId: string
  role: MarketplaceRole
  globalRole: string
  scientistId: string
  sponsorId: string
}

type AccessAction = "read" | "write"

function isPrivileged(role: MarketplaceRole) {
  return role === "admin" || role === "reviewer"
}

export async function buildMarketplaceActorContext(params: {
  userId: string
  name?: string | null
  globalRole?: string | null
  requestedRole?: MarketplaceRole
}) {
  const { scientist, sponsor } = await identityIntegration.ensureMarketplaceActors({
    id: params.userId,
    name: params.name,
  })

  return {
    userId: params.userId,
    role: identityIntegration.resolveRole(params.globalRole ?? undefined, params.requestedRole),
    globalRole: params.globalRole ?? "MEMBER",
    scientistId: scientist.id,
    sponsorId: sponsor.id,
  } satisfies MarketplaceActorContext
}

function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 })
}

async function getDealRoomForAccess(dealRoomId: string) {
  return db.marketplaceDealRoom.findUnique({ where: { id: dealRoomId } })
}

async function getDiscoveryForAccess(discoveryId: string) {
  return db.marketplaceDiscovery.findUnique({ where: { id: discoveryId } })
}

async function getFundingRequestForAccess(fundingRequestId: string) {
  return db.marketplaceFundingRequest.findUnique({ where: { id: fundingRequestId } })
}

async function canAccessDealRoomId(actor: MarketplaceActorContext, dealRoomId: string) {
  const dealRoom = await getDealRoomForAccess(dealRoomId)
  if (!dealRoom) {
    return false
  }

  return complianceService.canViewDealRoom(actor.role, JSON.parse(JSON.stringify(dealRoom)), actor.scientistId, actor.sponsorId)
}

export async function canAccessEntityRecord(
  actor: MarketplaceActorContext,
  entity: MarketplaceEntityName,
  record: Record<string, unknown>,
  action: AccessAction,
) {
  if (isPrivileged(actor.role)) {
    if (entity === "auditLogs" && action === "write") {
      return actor.role === "admin"
    }

    return true
  }

  switch (entity) {
    case "scientists":
      return record.userId === actor.userId
    case "sponsors":
      return record.userId === actor.userId
    case "discoveries": {
      if (actor.role === "scientist") {
        return record.scientistId === actor.scientistId
      }

      if (actor.role === "sponsor") {
        if (action === "write") {
          return false
        }

        if (record.status === "PUBLISHED") {
          return true
        }

        const dealRoom = await db.marketplaceDealRoom.findFirst({
          where: {
            discoveryId: String(record.id),
            sponsorId: actor.sponsorId,
          },
        })
        return Boolean(dealRoom)
      }

      return false
    }
    case "fundingRequests": {
      if (actor.role === "scientist") {
        return record.scientistId === actor.scientistId
      }

      if (actor.role === "sponsor") {
        if (action === "write") {
          return false
        }

        const discovery = await getDiscoveryForAccess(String(record.discoveryId))
        if (!discovery) {
          return false
        }

        if (discovery.status === "PUBLISHED") {
          return true
        }

        const dealRoom = await db.marketplaceDealRoom.findFirst({
          where: {
            discoveryId: discovery.id,
            sponsorId: actor.sponsorId,
          },
        })
        return Boolean(dealRoom)
      }

      return false
    }
    case "matchScores":
      if (actor.role === "scientist") {
        return record.scientistId === actor.scientistId && action === "read"
      }
      if (actor.role === "sponsor") {
        return record.sponsorId === actor.sponsorId
      }
      return false
    case "dealRooms":
      return complianceService.canViewDealRoom(actor.role, JSON.parse(JSON.stringify(record)), actor.scientistId, actor.sponsorId)
    case "messageThreads":
      return typeof record.dealRoomId === "string" ? canAccessDealRoomId(actor, record.dealRoomId) : false
    case "transactions":
      return typeof record.dealRoomId === "string" ? canAccessDealRoomId(actor, record.dealRoomId) : false
    case "auditLogs": {
      if (action === "write") {
        return false
      }

      if (record.actorUserId === actor.userId) {
        return true
      }

      return typeof record.dealRoomId === "string" ? canAccessDealRoomId(actor, record.dealRoomId) : false
    }
    case "notifications": {
      if (record.recipientUserId === actor.userId) {
        return true
      }

      return typeof record.dealRoomId === "string" ? canAccessDealRoomId(actor, record.dealRoomId) : false
    }
    default:
      return false
  }
}

export async function filterAccessibleRecords(
  actor: MarketplaceActorContext,
  entity: MarketplaceEntityName,
  records: Array<Record<string, unknown>>,
  action: AccessAction = "read",
) {
  const access = await Promise.all(records.map((record) => canAccessEntityRecord(actor, entity, record, action)))
  return records.filter((_, index) => access[index])
}

export async function assertEntityRecordAccess(
  actor: MarketplaceActorContext,
  entity: MarketplaceEntityName,
  record: Record<string, unknown> | null,
  action: AccessAction,
) {
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!(await canAccessEntityRecord(actor, entity, record, action))) {
    return forbidden()
  }

  return null
}

export async function assertEntityCreateAccess(
  actor: MarketplaceActorContext,
  entity: MarketplaceEntityName,
  payload: Record<string, unknown>,
) {
  if (isPrivileged(actor.role)) {
    return null
  }

  switch (entity) {
    case "scientists":
    case "sponsors":
      return payload.userId === actor.userId ? null : forbidden()
    case "discoveries":
      return payload.scientistId === actor.scientistId ? null : forbidden()
    case "fundingRequests":
      return payload.scientistId === actor.scientistId ? null : forbidden()
    case "matchScores":
      return actor.role === "sponsor" && payload.sponsorId === actor.sponsorId ? null : forbidden()
    case "dealRooms":
      if (actor.role === "scientist") {
        return payload.scientistId === actor.scientistId ? null : forbidden()
      }
      if (actor.role === "sponsor") {
        return payload.sponsorId === actor.sponsorId ? null : forbidden()
      }
      return forbidden()
    case "messageThreads":
      if (typeof payload.dealRoomId !== "string") {
        return forbidden()
      }
      return (await canAccessDealRoomId(actor, payload.dealRoomId)) ? null : forbidden()
    case "transactions":
      if (actor.role !== "sponsor") {
        return forbidden()
      }
      if (payload.sponsorId !== actor.sponsorId) {
        return forbidden()
      }
      return typeof payload.dealRoomId === "string" && (await canAccessDealRoomId(actor, payload.dealRoomId)) ? null : forbidden()
    case "auditLogs":
      return forbidden("Audit logs are immutable")
    case "notifications":
      return payload.recipientUserId === actor.userId ? null : forbidden()
    default:
      return forbidden()
  }
}

export async function assertDealRoomAccess(actor: MarketplaceActorContext, dealRoomId: string, action: AccessAction = "read") {
  const dealRoom = await db.marketplaceDealRoom.findUnique({ where: { id: dealRoomId }, include: { scientist: true } })
  if (!dealRoom) {
    return { response: NextResponse.json({ error: "Deal room not found" }, { status: 404 }) }
  }

  const allowed = await canAccessEntityRecord(actor, "dealRooms", JSON.parse(JSON.stringify(dealRoom)), action)
  if (!allowed) {
    return { response: forbidden() }
  }

  return { dealRoom }
}

export async function assertDiscoveryOwnership(actor: MarketplaceActorContext, discoveryId: string) {
  const discovery = await db.marketplaceDiscovery.findUnique({ where: { id: discoveryId } })
  if (!discovery) {
    return { response: NextResponse.json({ error: "Discovery not found" }, { status: 404 }) }
  }

  const access = await assertEntityRecordAccess(actor, "discoveries", JSON.parse(JSON.stringify(discovery)), "write")
  if (access) {
    return { response: access }
  }

  return { discovery }
}

export async function assertFundingRequestOwnership(actor: MarketplaceActorContext, discoveryId: string) {
  const fundingRequest = await db.marketplaceFundingRequest.findUnique({ where: { discoveryId } })
  if (!fundingRequest) {
    return { fundingRequest: null }
  }

  const access = await assertEntityRecordAccess(actor, "fundingRequests", JSON.parse(JSON.stringify(fundingRequest)), "write")
  if (access) {
    return { response: access }
  }

  return { fundingRequest }
}

export async function assertDiscoveryReadableBySponsor(actor: MarketplaceActorContext, discoveryId: string) {
  const discovery = await getDiscoveryForAccess(discoveryId)
  if (!discovery) {
    return { response: NextResponse.json({ error: "Discovery not found" }, { status: 404 }) }
  }

  const access = await assertEntityRecordAccess(actor, "discoveries", JSON.parse(JSON.stringify(discovery)), "read")
  if (access) {
    return { response: access }
  }

  return { discovery }
}
