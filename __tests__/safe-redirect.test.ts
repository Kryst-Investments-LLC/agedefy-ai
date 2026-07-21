import { describe, expect, it } from "vitest"

import { safeInternalPath } from "@/lib/security/safe-redirect"

const ORIGIN = "https://app.biozephyra.com"

describe("safeInternalPath (open-redirect guard, P0-SEC-009)", () => {
  it("allows same-origin relative paths", () => {
    expect(safeInternalPath("/dashboard", ORIGIN)).toBe("/dashboard")
    expect(safeInternalPath("/insights?tab=trends#x", ORIGIN)).toBe("/insights?tab=trends#x")
  })

  it("allows a same-origin absolute URL, reduced to its path", () => {
    expect(safeInternalPath(`${ORIGIN}/account`, ORIGIN)).toBe("/account")
  })

  it("rejects off-origin absolute URLs", () => {
    expect(safeInternalPath("https://evil.com", ORIGIN)).toBe("/dashboard")
    expect(safeInternalPath("https://evil.com/phish", ORIGIN)).toBe("/dashboard")
    expect(safeInternalPath("http://app.biozephyra.com.evil.com", ORIGIN)).toBe("/dashboard")
  })

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeInternalPath("//evil.com", ORIGIN)).toBe("/dashboard")
    expect(safeInternalPath("/\\evil.com", ORIGIN)).toBe("/dashboard")
    expect(safeInternalPath("\\\\evil.com", ORIGIN)).toBe("/dashboard")
    expect(safeInternalPath("/path\\..\\x", ORIGIN)).toBe("/dashboard")
  })

  it("rejects credential-embedding and javascript scheme", () => {
    expect(safeInternalPath("https://app.biozephyra.com@evil.com", ORIGIN)).toBe("/dashboard")
    expect(safeInternalPath("javascript:alert(1)", ORIGIN)).toBe("/dashboard")
  })

  it("falls back for empty / missing / malformed input", () => {
    expect(safeInternalPath(null, ORIGIN)).toBe("/dashboard")
    expect(safeInternalPath(undefined, ORIGIN)).toBe("/dashboard")
    expect(safeInternalPath("", ORIGIN)).toBe("/dashboard")
    expect(safeInternalPath("not a url", ORIGIN)).toBe("/dashboard")
  })

  it("honors a custom fallback", () => {
    expect(safeInternalPath("https://evil.com", ORIGIN, "/sign-in")).toBe("/sign-in")
  })
})
