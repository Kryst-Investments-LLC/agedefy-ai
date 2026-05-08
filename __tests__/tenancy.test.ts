import { afterEach, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { deriveTenantContext, resolveStoredTenantContextForUser } from "@/lib/tenancy"

const createdIds = {
  userId: "tenant-test-user",
  tenantId: "tenant-test-tenant",
  organizationId: "tenant-test-org",
}

async function cleanup() {
  await db.organizationMembership.deleteMany({ where: { userId: createdIds.userId } })
  await db.organization.deleteMany({ where: { id: createdIds.organizationId } })
  await db.user.deleteMany({ where: { id: createdIds.userId } })
  await db.tenant.deleteMany({ where: { id: createdIds.tenantId } })
}

describe("tenancy", () => {
  afterEach(async () => {
    await cleanup()
  })

  it("resolves stored tenant context from a user's default membership", async () => {
    await db.tenant.create({
      data: {
        id: createdIds.tenantId,
        slug: "tenant-test-tenant",
        name: "Tenant Test",
      },
    })
    await db.organization.create({
      data: {
        id: createdIds.organizationId,
        tenantId: createdIds.tenantId,
        slug: "tenant-test-org",
        name: "Tenant Test Org",
      },
    })
    await db.user.create({
      data: {
        id: createdIds.userId,
        email: "tenant-test@example.com",
        passwordHash: "hashed-password",
      },
    })
    await db.organizationMembership.create({
      data: {
        tenantId: createdIds.tenantId,
        organizationId: createdIds.organizationId,
        userId: createdIds.userId,
        isDefault: true,
      },
    })

    await db.user.update({
      where: { id: createdIds.userId },
      data: { defaultTenantId: createdIds.tenantId },
    })

    const tenantContext = await resolveStoredTenantContextForUser(createdIds.userId)

    expect(tenantContext.tenantId).toBe(createdIds.tenantId)
    expect(tenantContext.organizationId).toBe(createdIds.organizationId)
  })

  it("prefers session tenant context over request headers", () => {
    const tenantContext = deriveTenantContext({
      sessionUser: {
        id: "session-user",
        tenantId: "tenant-from-session",
        organizationId: "org-from-session",
      },
      request: new Request("https://example.test/api/demo", {
        headers: {
          "x-tenant-id": "tenant-from-header",
          "x-organization-id": "org-from-header",
        },
      }),
    })

    expect(tenantContext.tenantId).toBe("tenant-from-session")
    expect(tenantContext.organizationId).toBe("org-from-session")
  })
})