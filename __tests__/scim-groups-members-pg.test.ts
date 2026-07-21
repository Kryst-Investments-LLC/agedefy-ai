import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { db } from "@/lib/db"

const SECRET = "scim-test-shared-secret-value"
const suffix = "scimgrp"
const tenantId = `tenant-${suffix}`
const orgId = `org-${suffix}`
const users = [`${suffix}-u1`, `${suffix}-u2`, `${suffix}-u3`]

function patch(body: unknown) {
  return new NextRequest(`http://localhost/api/scim/v2/Groups/${orgId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(body),
  })
}

const PATCH_SCHEMAS = ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
const addOp = (ids: string[]) => ({
  schemas: PATCH_SCHEMAS,
  Operations: [{ op: "add", path: "members", value: ids.map((value) => ({ value })) }],
})
const removeOp = (ids: string[]) => ({
  schemas: PATCH_SCHEMAS,
  Operations: [{ op: "remove", path: "members", value: ids.map((value) => ({ value })) }],
})

async function memberCount() {
  return db.organizationMembership.count({ where: { organizationId: orgId } })
}

describe("SCIM Groups membership batching (P1-PERF-012, no N+1)", () => {
  beforeAll(async () => {
    process.env.SCIM_SHARED_SECRET = SECRET
    await db.tenant.create({ data: { id: tenantId, slug: tenantId, name: "SCIM Test Tenant" } })
    await db.organization.create({
      data: { id: orgId, name: "SCIM Test Org", slug: `scim-test-org-${suffix}`, tenantId },
    })
    for (const id of users) {
      await db.user.create({ data: { id, email: `${id}@example.com`, passwordHash: "x", name: id } })
    }
  })

  afterAll(async () => {
    await db.organizationMembership.deleteMany({ where: { organizationId: orgId } })
    await db.organization.deleteMany({ where: { id: orgId } })
    await db.user.deleteMany({ where: { id: { in: users } } })
    await db.tenant.deleteMany({ where: { id: tenantId } })
    delete process.env.SCIM_SHARED_SECRET
  })

  it("adds a whole member list in one batch", async () => {
    const { PATCH } = await import("@/app/api/scim/v2/Groups/[id]/route")
    const res = await PATCH(patch(addOp(users)), { params: Promise.resolve({ id: orgId }) })
    expect(res.status).toBe(200)
    expect(await memberCount()).toBe(3)
  })

  it("is idempotent when re-adding an existing member (skipDuplicates)", async () => {
    const { PATCH } = await import("@/app/api/scim/v2/Groups/[id]/route")
    const res = await PATCH(patch(addOp([users[0]])), { params: Promise.resolve({ id: orgId }) })
    expect(res.status).toBe(200)
    expect(await memberCount()).toBe(3) // no duplicate, no error
  })

  it("removes a batch of members in one call", async () => {
    const { PATCH } = await import("@/app/api/scim/v2/Groups/[id]/route")
    const res = await PATCH(patch(removeOp([users[0], users[1]])), { params: Promise.resolve({ id: orgId }) })
    expect(res.status).toBe(200)
    expect(await memberCount()).toBe(1)
  })
})
