import { describe, it, expect, vi, beforeEach } from "vitest"
import { logger } from "@/lib/logger"

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("writes JSON to stdout for info level", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
    logger.info("test message", { key: "value" })

    expect(writeSpy).toHaveBeenCalledOnce()
    const output = writeSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed.level).toBe("info")
    expect(parsed.message).toBe("test message")
    expect(parsed.key).toBe("value")
    expect(parsed.timestamp).toBeDefined()
  })

  it("writes JSON to stderr for error level", () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    logger.error("bad thing", { code: 500 })

    expect(writeSpy).toHaveBeenCalledOnce()
    const output = writeSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed.level).toBe("error")
    expect(parsed.message).toBe("bad thing")
    expect(parsed.code).toBe(500)
  })

  it("emits valid JSON with newline", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
    logger.warn("warning test")

    const output = writeSpy.mock.calls[0][0] as string
    expect(output.endsWith("\n")).toBe(true)
    expect(() => JSON.parse(output)).not.toThrow()
  })

  it("redacts sensitive top-level keys (email, token, secret)", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
    logger.info("reset", { userId: "u_123", email: "a@b.dev", resetToken: "abc", secretKey: "s" })

    const parsed = JSON.parse(writeSpy.mock.calls[0][0] as string)
    expect(parsed.userId).toBe("u_123") // non-sensitive preserved
    expect(parsed.email).toBe("[redacted]")
    expect(parsed.resetToken).toBe("[redacted]")
    expect(parsed.secretKey).toBe("[redacted]")
  })

  it("redacts sensitive keys nested inside objects and arrays", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
    logger.info("nested", { user: { id: "u1", email: "x@y.dev" }, actors: [{ password: "p" }] })

    const parsed = JSON.parse(writeSpy.mock.calls[0][0] as string)
    expect(parsed.user.id).toBe("u1")
    expect(parsed.user.email).toBe("[redacted]")
    expect(parsed.actors[0].password).toBe("[redacted]")
  })
})
