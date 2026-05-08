import { afterEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeIdempotentJsonMutation, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"

const tenantId = "tenant-idempotency-test"
const route = "/api/test/idempotency"
const method = "POST"
const key = "idem-key-1"

async function cleanup() {
  await db.idempotencyRecord.deleteMany({ where: { tenantId, route, method } })
}

describe("executeIdempotentJsonMutation", () => {
  afterEach(async () => {
    await cleanup()
  })

  it("replays a completed response for the same idempotency key and fingerprint", async () => {
    const execute = vi.fn(async () => ({
      status: 201,
      body: { ok: true, requestId: "req-1" },
    }))
    const requestFingerprint = createIdempotencyFingerprint({ amount: 1 })

    const firstResponse = await executeIdempotentJsonMutation({
      tenantId,
      route,
      method,
      key,
      actorUserId: "tenant-idempotency-user",
      requestFingerprint,
      execute,
    })
    const secondResponse = await executeIdempotentJsonMutation({
      tenantId,
      route,
      method,
      key,
      actorUserId: "tenant-idempotency-user",
      requestFingerprint,
      execute,
    })

    expect(firstResponse.status).toBe(201)
    expect(secondResponse.status).toBe(201)
    expect(secondResponse.headers.get("Idempotency-Replayed")).toBe("true")
    await expect(secondResponse.json()).resolves.toEqual({ ok: true, requestId: "req-1" })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("rejects a reused idempotency key when the fingerprint changes", async () => {
    const execute = vi.fn(async () => ({
      status: 200,
      body: { ok: true },
    }))

    await executeIdempotentJsonMutation({
      tenantId,
      route,
      method,
      key,
      requestFingerprint: createIdempotencyFingerprint({ amount: 1 }),
      execute,
    })

    const conflictingResponse = await executeIdempotentJsonMutation({
      tenantId,
      route,
      method,
      key,
      requestFingerprint: createIdempotencyFingerprint({ amount: 2 }),
      execute,
    })

    expect(conflictingResponse.status).toBe(409)
    await expect(conflictingResponse.json()).resolves.toEqual({
      error: "Idempotency key is already associated with a different request.",
    })
  })

  it("rejects route-level mutations when the idempotency key header is missing and requireKey is true", async () => {
    const execute = vi.fn(async () => ({
      status: 201,
      body: { ok: true },
    }))

    const response = await executeRouteIdempotentJsonMutation({
      request: new Request("http://localhost:3000/api/test/idempotency", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ amount: 1 }),
      }),
      tenantId,
      actorUserId: "tenant-idempotency-user",
      requestFingerprint: createIdempotencyFingerprint({ amount: 1 }),
      requireKey: true,
      execute,
    })

    expect(response.status).toBe(400)
    expect(response.headers.get("Idempotency-Key-Required")).toBe("true")
    await expect(response.json()).resolves.toEqual({
      error: "Idempotency-Key header is required for this mutation route.",
    })
    expect(execute).not.toHaveBeenCalled()
  })
})