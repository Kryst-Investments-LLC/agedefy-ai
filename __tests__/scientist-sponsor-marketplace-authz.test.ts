import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    marketplaceDealRoom: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    marketplaceDiscovery: {
      findUnique: vi.fn(),
    },
    marketplaceFundingRequest: {
      findUnique: vi.fn(),
    },
  },
}))

import { canAccessEntityRecord, type MarketplaceActorContext } from "@/scientist-sponsor-marketplace/backend/permissions/access-control"
import { identityIntegration } from "@/scientist-sponsor-marketplace/backend/integrations/identityIntegration"
import { getAssumableMarketplaceRoles } from "@/scientist-sponsor-marketplace/shared/utils"

function buildActor(overrides: Partial<MarketplaceActorContext>): MarketplaceActorContext {
  return {
    userId: "user-1",
    role: "scientist",
    globalRole: "MEMBER",
    scientistId: "scientist-1",
    sponsorId: "sponsor-1",
    ...overrides,
  }
}

describe("marketplace role availability", () => {
  it("limits members to scientist and sponsor tabs", () => {
    expect(getAssumableMarketplaceRoles("MEMBER")).toEqual(["scientist", "sponsor"])
  })

  it("exposes reviewer for researchers and admin for admins", () => {
    expect(getAssumableMarketplaceRoles("RESEARCHER")).toEqual(["scientist", "sponsor", "reviewer"])
    expect(getAssumableMarketplaceRoles("ADMIN")).toEqual(["scientist", "sponsor", "reviewer", "admin"])
  })

  it("rejects actingAs escalation for unavailable roles", () => {
    expect(identityIntegration.resolveRole("MEMBER", "admin")).toBe("scientist")
    expect(identityIntegration.resolveRole("MEMBER", "reviewer")).toBe("scientist")
    expect(identityIntegration.resolveRole("RESEARCHER", "admin")).toBe("reviewer")
  })
})

describe("marketplace record authorization", () => {
  it("allows a scientist owner to read and write their own discovery", async () => {
    const actor = buildActor({ role: "scientist" })
    const record = {
      id: "discovery-1",
      scientistId: "scientist-1",
      status: "DRAFT",
    }

    await expect(canAccessEntityRecord(actor, "discoveries", record, "read")).resolves.toBe(true)
    await expect(canAccessEntityRecord(actor, "discoveries", record, "write")).resolves.toBe(true)
  })

  it("denies a non-owner scientist from reading or writing another discovery", async () => {
    const actor = buildActor({ role: "scientist", scientistId: "scientist-2" })
    const record = {
      id: "discovery-1",
      scientistId: "scientist-1",
      status: "DRAFT",
    }

    await expect(canAccessEntityRecord(actor, "discoveries", record, "read")).resolves.toBe(false)
    await expect(canAccessEntityRecord(actor, "discoveries", record, "write")).resolves.toBe(false)
  })

  it("allows sponsors to read published discoveries but not mutate them", async () => {
    const actor = buildActor({ role: "sponsor" })
    const record = {
      id: "discovery-1",
      scientistId: "scientist-1",
      status: "PUBLISHED",
    }

    await expect(canAccessEntityRecord(actor, "discoveries", record, "read")).resolves.toBe(true)
    await expect(canAccessEntityRecord(actor, "discoveries", record, "write")).resolves.toBe(false)
  })

  it("restricts deal-room access to the participating scientist and sponsor", async () => {
    const dealRoom = {
      id: "deal-room-1",
      scientistId: "scientist-1",
      sponsorId: "sponsor-1",
    }

    await expect(canAccessEntityRecord(buildActor({ role: "scientist" }), "dealRooms", dealRoom, "read")).resolves.toBe(true)
    await expect(canAccessEntityRecord(buildActor({ role: "sponsor" }), "dealRooms", dealRoom, "read")).resolves.toBe(true)
    await expect(
      canAccessEntityRecord(buildActor({ role: "scientist", scientistId: "scientist-9" }), "dealRooms", dealRoom, "read"),
    ).resolves.toBe(false)
    await expect(
      canAccessEntityRecord(buildActor({ role: "sponsor", sponsorId: "sponsor-9" }), "dealRooms", dealRoom, "read"),
    ).resolves.toBe(false)
  })
})