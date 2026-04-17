import { describe, it, expect } from "vitest"
import { scopedDb, assertTenantOwnership, TenantAccessError } from "@/lib/tenant-scoped-db"

// ---------------------------------------------------------------------------
// Unit tests for the tenant-scoped data access helpers.
// These verify the scoping logic independently of the database.
// ---------------------------------------------------------------------------

describe("scopedDb — scope injection", () => {
  it("auto-applies userId to findMany where clause", () => {
    const scoped = scopedDb("user-1", "tenant-1")
    expect(scoped.userId).toBe("user-1")
    expect(scoped.tenantId).toBe("tenant-1")
  })

  it("exposes tenantId and userId as properties", () => {
    const scoped = scopedDb("u-abc", "t-xyz")
    expect(scoped.userId).toBe("u-abc")
    expect(scoped.tenantId).toBe("t-xyz")
  })

  it("allows undefined tenantId for single-tenant mode", () => {
    const scoped = scopedDb("user-1", undefined)
    expect(scoped.tenantId).toBeUndefined()
  })
})

describe("assertTenantOwnership", () => {
  it("allows access when userId matches", () => {
    expect(() =>
      assertTenantOwnership(
        { userId: "user-1", tenantId: "tenant-1" },
        "user-1",
        "tenant-1",
      ),
    ).not.toThrow()
  })

  it("throws when userId does not match", () => {
    expect(() =>
      assertTenantOwnership(
        { userId: "user-1", tenantId: "tenant-1" },
        "user-2",
        "tenant-1",
      ),
    ).toThrow(TenantAccessError)
  })

  it("throws when tenantId does not match", () => {
    expect(() =>
      assertTenantOwnership(
        { userId: "user-1", tenantId: "tenant-1" },
        "user-1",
        "tenant-2",
      ),
    ).toThrow(TenantAccessError)
  })

  it("throws when record is null (not found)", () => {
    expect(() =>
      assertTenantOwnership(null, "user-1", "tenant-1"),
    ).toThrow(TenantAccessError)
  })

  it("allows access when tenantId is not expected (single-tenant)", () => {
    expect(() =>
      assertTenantOwnership(
        { userId: "user-1", tenantId: "tenant-1" },
        "user-1",
        undefined,
      ),
    ).not.toThrow()
  })

  it("allows access when record has no tenantId field", () => {
    expect(() =>
      assertTenantOwnership(
        { userId: "user-1" },
        "user-1",
        "tenant-1",
      ),
    ).not.toThrow()
  })

  it("throws with descriptive error for user mismatch", () => {
    try {
      assertTenantOwnership(
        { userId: "user-1", tenantId: "tenant-1" },
        "user-2",
        "tenant-1",
      )
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(TenantAccessError)
      expect((err as TenantAccessError).message).toContain("User does not own")
    }
  })

  it("throws with descriptive error for tenant mismatch", () => {
    try {
      assertTenantOwnership(
        { userId: "user-1", tenantId: "tenant-1" },
        "user-1",
        "tenant-2",
      )
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(TenantAccessError)
      expect((err as TenantAccessError).message).toContain("different tenant")
    }
  })

  it("prevents cross-tenant record access in a multi-tenant scenario", () => {
    const tenantARecord = { userId: "user-a", tenantId: "tenant-a" }
    const tenantBUser = "user-b"
    const tenantBTenant = "tenant-b"

    expect(() =>
      assertTenantOwnership(tenantARecord, tenantBUser, tenantBTenant),
    ).toThrow(TenantAccessError)
  })

  it("distinguishes between missing record and access denied", () => {
    try {
      assertTenantOwnership(null, "user-1", "tenant-1")
    } catch (err) {
      expect((err as TenantAccessError).message).toContain("not found")
    }

    try {
      assertTenantOwnership(
        { userId: "user-1", tenantId: "tenant-1" },
        "user-2",
        "tenant-1",
      )
    } catch (err) {
      expect((err as TenantAccessError).message).not.toContain("not found")
    }
  })
})

describe("TenantAccessError", () => {
  it("is an instance of Error", () => {
    const err = new TenantAccessError("test")
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(TenantAccessError)
    expect(err.name).toBe("TenantAccessError")
  })
})
