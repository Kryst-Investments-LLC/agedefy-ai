import { describe, expect, it, vi, beforeAll, afterAll } from "vitest"
import { validateScimAuth, parseScimFilter, toScimUser, toScimListResponse, scimError, applyScimPatch, type ScimPatchOp } from "@/lib/scim"

let originalScimSecret: string | undefined

beforeAll(() => {
  originalScimSecret = process.env.SCIM_SHARED_SECRET
  process.env.SCIM_SHARED_SECRET = "test-scim-secret-1234"
})

afterAll(() => {
  if (originalScimSecret !== undefined) {
    process.env.SCIM_SHARED_SECRET = originalScimSecret
  } else {
    delete process.env.SCIM_SHARED_SECRET
  }
})

describe("SCIM library", () => {
  describe("validateScimAuth", () => {
    it("returns true for valid bearer token", () => {
      const req = new Request("http://localhost/scim/v2/Users", {
        headers: { Authorization: "Bearer test-scim-secret-1234" },
      })
      expect(validateScimAuth(req)).toBe(true)
    })

    it("returns false for invalid bearer token", () => {
      const req = new Request("http://localhost/scim/v2/Users", {
        headers: { Authorization: "Bearer wrong-secret" },
      })
      expect(validateScimAuth(req)).toBe(false)
    })

    it("returns false for missing Authorization header", () => {
      const req = new Request("http://localhost/scim/v2/Users")
      expect(validateScimAuth(req)).toBe(false)
    })
  })

  describe("parseScimFilter", () => {
    it("parses eq filter on userName", () => {
      const result = parseScimFilter('userName eq "john@example.com"')
      expect(result).toEqual({ field: "userName", op: "eq", value: "john@example.com" })
    })

    it("parses co filter on userName", () => {
      const result = parseScimFilter('userName co "john"')
      expect(result).toEqual({ field: "userName", op: "co", value: "john" })
    })

    it("parses sw filter on userName", () => {
      const result = parseScimFilter('userName sw "john"')
      expect(result).toEqual({ field: "userName", op: "sw", value: "john" })
    })

    it("returns null for unsupported filter", () => {
      const result = parseScimFilter('displayName ne "John"')
      expect(result).toBeNull()
    })

    it("returns null for empty filter", () => {
      expect(parseScimFilter("")).toBeNull()
      expect(parseScimFilter(null)).toBeNull()
    })
  })

  describe("toScimUser", () => {
    it("serializes a user to SCIM format", () => {
      const user = {
        id: "u-1",
        email: "test@example.com",
        name: "Test User",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-02"),
      }
      const result = toScimUser(user, "https://app.example.com")

      expect(result.schemas).toContain("urn:ietf:params:scim:schemas:core:2.0:User")
      expect(result.id).toBe("u-1")
      expect(result.userName).toBe("test@example.com")
      expect(result.displayName).toBe("Test User")
      expect(result.active).toBe(true)
      expect(result.meta.location).toContain("/api/scim/v2/Users/u-1")
    })
  })

  describe("toScimListResponse", () => {
    it("wraps items in a SCIM ListResponse", () => {
      const items = [{ id: "1" }, { id: "2" }]
      const result = toScimListResponse(items, 10, 1)

      expect(result.schemas).toContain("urn:ietf:params:scim:api:messages:2.0:ListResponse")
      expect(result.totalResults).toBe(10)
      expect(result.startIndex).toBe(1)
      expect(result.Resources).toHaveLength(2)
    })
  })

  describe("scimError", () => {
    it("returns a SCIM error response", () => {
      const result = scimError(404, "not found")
      expect(result.schemas).toContain("urn:ietf:params:scim:api:messages:2.0:Error")
      expect(result.status).toBe("404")
      expect(result.detail).toBe("not found")
    })
  })

  describe("applyScimPatch", () => {
    it("handles replace operations", () => {
      const data: Record<string, unknown> = { displayName: "Old", active: true }
      const result = applyScimPatch(data, [
        { op: "replace", path: "displayName", value: "New" },
        { op: "replace", path: "active", value: false },
      ])
      expect(result.displayName).toBe("New")
      expect(result.active).toBe(false)
    })

    it("handles add operations", () => {
      const data: Record<string, unknown> = {}
      const result = applyScimPatch(data, [
        { op: "add", path: "displayName", value: "Added" },
      ])
      expect(result.displayName).toBe("Added")
    })

    it("handles remove operations", () => {
      const data: Record<string, unknown> = { displayName: "Remove me" }
      const result = applyScimPatch(data, [
        { op: "remove", path: "displayName" },
      ])
      expect(result.displayName).toBeUndefined()
    })
  })
})
