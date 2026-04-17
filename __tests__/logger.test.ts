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
})
