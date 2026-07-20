import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getServerSessionMock = vi.fn()

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/rate-limit", () => ({ applyRateLimit: vi.fn(async () => null) }))

// eslint-disable-next-line import/first
import { db } from "@/lib/db"

const suffix = Date.now().toString(36)
const userA = `authz-a-${suffix}`
const userB = `authz-b-${suffix}`

async function makeUser(id: string) {
  await db.user.create({ data: { id, email: `${id}@example.com`, passwordHash: "x", name: id } })
  // recent MFA so requireRecentMfa on the owned-resource routes is satisfied
  await db.userMfaSecret.upsert({
    where: { userId: id },
    update: { verified: true, lastVerifiedAt: new Date() },
    create: { userId: id, secret: "s", verified: true, lastVerifiedAt: new Date() },
  })
}

function sessionFor(id: string, role = "MEMBER") {
  return { user: { id, email: `${id}@example.com`, name: id, role, tenantId: "default" } }
}

function deleteRequest(id: string) {
  return new NextRequest(`http://localhost/api/resource/${id}`, {
    method: "DELETE",
    headers: { "idempotency-key": `idem-${id}-${Math.random().toString(36).slice(2)}` },
  })
}

afterAll(async () => {
  const ids = [userA, userB]
  await db.biomarker.deleteMany({ where: { userId: { in: ids } } })
  await db.protocol.deleteMany({ where: { userId: { in: ids } } })
  await db.userMfaSecret.deleteMany({ where: { userId: { in: ids } } })
  await db.idempotencyRecord.deleteMany({ where: { actorUserId: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
})

describe("object-level authorization (IDOR) + role gate (P0-SEC-009)", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
  })

  it("a user cannot DELETE another user's biomarker (404, resource untouched)", async () => {
    await makeUser(userA)
    await makeUser(userB)
    const bm = await db.biomarker.create({
      data: { userId: userA, name: "hsCRP", value: 0.8, unit: "mg/L" },
    })

    getServerSessionMock.mockResolvedValue(sessionFor(userB)) // attacker = B
    const { DELETE } = await import("@/app/api/biomarkers/[id]/route")
    const res = await DELETE(deleteRequest(bm.id), { params: Promise.resolve({ id: bm.id }) })

    expect(res.status).toBe(404) // scoped by {id, userId} — B sees "not found", no leak
    expect(await db.biomarker.count({ where: { id: bm.id } })).toBe(1) // A's biomarker survives
  })

  it("a user cannot DELETE another user's protocol (404, resource untouched)", async () => {
    const proto = await db.protocol.create({ data: { userId: userA, name: "Protocol A" } })

    getServerSessionMock.mockResolvedValue(sessionFor(userB))
    const { DELETE } = await import("@/app/api/protocols/[id]/route")
    const res = await DELETE(deleteRequest(proto.id), { params: Promise.resolve({ id: proto.id }) })

    expect(res.status).toBe(404)
    expect(await db.protocol.count({ where: { id: proto.id } })).toBe(1)
  })

  it("the owner CAN delete their own biomarker (proves 404 above is the IDOR guard, not a broken route)", async () => {
    const bm = await db.biomarker.create({
      data: { userId: userA, name: "LDL", value: 90, unit: "mg/dL" },
    })

    getServerSessionMock.mockResolvedValue(sessionFor(userA)) // owner = A
    const { DELETE } = await import("@/app/api/biomarkers/[id]/route")
    const res = await DELETE(deleteRequest(bm.id), { params: Promise.resolve({ id: bm.id }) })

    expect(res.status).toBe(200)
    expect(await db.biomarker.count({ where: { id: bm.id } })).toBe(0)
  })

  it("a non-admin session is denied an ADMIN route (403)", async () => {
    getServerSessionMock.mockResolvedValue(sessionFor(userB, "MEMBER"))
    const { PATCH } = await import("@/app/api/admin/users/route")
    const res = await PATCH(
      new NextRequest("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "x", role: "ADMIN" }),
      }),
    )
    expect(res.status).toBe(403)
  })
})
